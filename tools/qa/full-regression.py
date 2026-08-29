#!/usr/bin/env python3
# ATHR full local regression runner.
# Tests compile/Prisma, storefront/admin reachability, health/catalog,
# admin auth + CRUD, Cloudinary cover upload, private PDF upload,
# customer auth, wishlist, newsletter, mock checkout/payment,
# library/download authorization, admin visibility, and cleanup.

from __future__ import annotations

import argparse
import base64
import getpass
import http.cookiejar
import json
import os
import re
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
API = "http://127.0.0.1:4000/api"
STORE = "http://127.0.0.1:8090"
ADMIN_SITE = "http://127.0.0.1:3100"

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

PASSED = 0
FAILED = 0
SKIPPED = 0


def ok(label: str) -> None:
    global PASSED
    PASSED += 1
    print(f"{GREEN}PASS{RESET}  {label}")


def fail(label: str, detail: str = "") -> None:
    global FAILED
    FAILED += 1
    print(f"{RED}FAIL{RESET}  {label}")
    if detail:
        print(f"      {detail}")


def skip(label: str, detail: str = "") -> None:
    global SKIPPED
    SKIPPED += 1
    print(f"{YELLOW}SKIP{RESET}  {label}")
    if detail:
        print(f"      {detail}")


class TestFailure(RuntimeError):
    pass


@dataclass
class Response:
    status: int
    headers: Any
    body: bytes

    def json(self) -> Any:
        return json.loads(self.body.decode("utf-8"))


class Client:
    def __init__(self) -> None:
        jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar)
        )

    def request(
        self,
        method: str,
        url: str,
        *,
        json_body: Any | None = None,
        data: bytes | None = None,
        headers: dict[str, str] | None = None,
        allow_error: bool = False,
    ) -> Response:
        hdrs = {"Accept": "application/json"}
        if headers:
            hdrs.update(headers)

        payload = data
        if json_body is not None:
            payload = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
            hdrs["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=payload, headers=hdrs, method=method)

        try:
            with self.opener.open(req, timeout=25) as resp:
                return Response(resp.status, resp.headers, resp.read())
        except urllib.error.HTTPError as exc:
            body = exc.read()
            if allow_error:
                return Response(exc.code, exc.headers, body)
            try:
                parsed = json.loads(body.decode("utf-8"))
                message = parsed.get("message", parsed)
            except Exception:
                message = body.decode("utf-8", errors="replace")[:500]
            raise TestFailure(
                f"{method} {url} -> HTTP {exc.code}: {message}"
            ) from exc
        except Exception as exc:
            raise TestFailure(f"{method} {url} failed: {exc}") from exc


def multipart(
    fields: dict[str, str],
    file_field: str,
    filename: str,
    mime: str,
    content: bytes,
) -> tuple[bytes, str]:
    boundary = f"----ATHRQA{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for key, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )

    chunks.extend(
        [
            f"--{boundary}\r\n".encode(),
            (
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{filename}"\r\n'
            ).encode(),
            f"Content-Type: {mime}\r\n\r\n".encode(),
            content,
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def run_cmd(label: str, cmd: list[str], cwd: Path = ROOT, timeout: int = 240) -> None:
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
    except Exception as exc:
        fail(label, str(exc))
        raise TestFailure(label) from exc

    if result.returncode != 0:
        detail = (result.stdout + "\n" + result.stderr).strip()[-3500:]
        fail(label, detail)
        raise TestFailure(label)

    ok(label)


def expect(condition: bool, label: str, detail: str = "") -> None:
    if not condition:
        fail(label, detail)
        raise TestFailure(label)
    ok(label)


def get_json(client: Client, url: str) -> Any:
    return client.request("GET", url).json()


def wait_for_json(
    client: Client,
    url: str,
    *,
    timeout_seconds: float = 25.0,
    interval_seconds: float = 0.75,
) -> Any:
    deadline = time.time() + timeout_seconds
    last_error: Exception | None = None

    while time.time() < deadline:
        try:
            return get_json(client, url)
        except Exception as exc:
            last_error = exc
            time.sleep(interval_seconds)

    raise TestFailure(
        f"Timed out waiting for {url}: {last_error or 'unknown error'}"
    )


def port_is_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False


def start_local_service(
    label: str,
    command: list[str],
    *,
    port: int,
    log_path: str,
) -> subprocess.Popen[bytes] | None:
    if port_is_open("127.0.0.1", port):
        ok(f"{label} already running on {port}")
        return None

    log_file = open(log_path, "ab", buffering=0)
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )

    deadline = time.time() + 35
    while time.time() < deadline:
        if process.poll() is not None:
            try:
                log_file.close()
            except Exception:
                pass
            tail = ""
            try:
                tail = Path(log_path).read_text(
                    encoding="utf-8",
                    errors="replace",
                )[-3000:]
            except Exception:
                pass
            raise TestFailure(
                f"{label} exited before opening port {port}. "
                f"Log: {log_path}\n{tail}"
            )
        if port_is_open("127.0.0.1", port):
            ok(f"{label} started on {port}")
            return process
        time.sleep(0.5)

    try:
        os.killpg(process.pid, signal.SIGTERM)
    except Exception:
        pass
    raise TestFailure(
        f"{label} did not open port {port} within 35 seconds. "
        f"See {log_path}"
    )


def stop_local_service(
    label: str,
    process: subprocess.Popen[bytes] | None,
) -> None:
    if process is None:
        return
    if process.poll() is not None:
        return

    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=8)
        ok(f"stopped QA-started {label}")
    except Exception:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except Exception:
            pass


def ensure_local_stack() -> dict[str, subprocess.Popen[bytes] | None]:
    started: dict[str, subprocess.Popen[bytes] | None] = {
        "api": None,
        "admin": None,
        "store": None,
    }

    # Build/typecheck happens before this. QA runs the compiled API directly
    # for deterministic regression behavior and only starts missing services.
    started["api"] = start_local_service(
        "Local API",
        ["node", "apps/api/dist/main.js"],
        port=4000,
        log_path="/tmp/athr-qa-api.log",
    )
    started["admin"] = start_local_service(
        "Local Admin",
        ["npm", "run", "dev:admin"],
        port=3100,
        log_path="/tmp/athr-qa-admin.log",
    )
    started["store"] = start_local_service(
        "Local Storefront",
        [
            "python3",
            "-m",
            "http.server",
            "8090",
            "--bind",
            "127.0.0.1",
        ],
        port=8090,
        log_path="/tmp/athr-qa-store.log",
    )

    return started


def psql(sql: str, *, allow_fail: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        [
            "docker",
            "exec",
            "athr-postgres",
            "psql",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "athr",
            "-d",
            "athr",
            "-c",
            sql,
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0 and not allow_fail:
        raise TestFailure(result.stderr.strip() or "psql command failed")
    return result


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def bootstrap_qa_admin(email: str, password: str) -> None:
    env = os.environ.copy()
    env.update(
        {
            "ATHR_ADMIN_EMAIL": email,
            "ATHR_ADMIN_PASSWORD": password,
            "ATHR_ADMIN_NAME": "ATHR QA Super Admin",
        }
    )

    result = subprocess.run(
        ["npm", "run", "admin:bootstrap"],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=180,
    )

    if result.returncode != 0:
        detail = (result.stdout + "\n" + result.stderr).strip()[-3500:]
        fail("Create temporary QA admin", detail)
        raise TestFailure("Temporary QA admin bootstrap failed.")

    ok("Temporary QA admin created")


def cleanup(
    admin: Client | None,
    *,
    qa_email: str | None,
    qa_admin_email: str | None,
    product_id: str | None,
    category_id: str | None,
) -> None:
    print("\n--- QA cleanup ---")

    if product_id and admin:
        try:
            r = admin.request(
                "DELETE",
                f"{API}/admin/products/{product_id}/digital-file",
                allow_error=True,
            )
            if r.status in (200, 404):
                ok("cleanup private digital file")
            else:
                skip("cleanup private digital file", f"HTTP {r.status}")
        except Exception as exc:
            skip("cleanup private digital file", str(exc))

    if qa_email:
        try:
            email_literal = sql_quote(qa_email)
            sql = (
                "DO $$\n"
                "DECLARE uid text;\n"
                "BEGIN\n"
                f'  SELECT id INTO uid FROM "User" WHERE email = {email_literal};\n'
                "  IF uid IS NOT NULL THEN\n"
                '    DELETE FROM "Order" WHERE "userId" = uid;\n'
                f'    DELETE FROM "NewsletterSubscription" WHERE email = {email_literal};\n'
                '    DELETE FROM "User" WHERE id = uid;\n'
                "  ELSE\n"
                f'    DELETE FROM "NewsletterSubscription" WHERE email = {email_literal};\n'
                "  END IF;\n"
                "END $$;"
            )
            psql(sql)
            ok("cleanup QA customer/order/newsletter")
        except Exception as exc:
            skip("cleanup QA customer/order/newsletter", str(exc))

    if product_id and admin:
        try:
            r = admin.request(
                "DELETE",
                f"{API}/admin/products/{product_id}",
                allow_error=True,
            )
            if r.status == 200:
                ok("cleanup QA product + Cloudinary assets")
            else:
                skip(
                    "cleanup QA product + Cloudinary assets",
                    f"HTTP {r.status}: {r.body[:250]!r}",
                )
        except Exception as exc:
            skip("cleanup QA product + Cloudinary assets", str(exc))

    if category_id and admin:
        try:
            r = admin.request(
                "DELETE",
                f"{API}/admin/categories/{category_id}",
                allow_error=True,
            )
            if r.status == 200:
                ok("cleanup QA category")
            else:
                skip(
                    "cleanup QA category",
                    f"HTTP {r.status}: {r.body[:250]!r}",
                )
        except Exception as exc:
            skip("cleanup QA category", str(exc))

    ids = [value for value in [product_id, category_id] if value]
    if ids:
        try:
            literals = ",".join(sql_quote(value) for value in ids)
            psql(
                f'DELETE FROM "AdminAuditLog" WHERE "entityId" IN ({literals});',
                allow_fail=True,
            )
        except Exception:
            pass

    if qa_admin_email:
        try:
            admin_email_literal = sql_quote(qa_admin_email)
            sql = (
                "DO $$\n"
                "DECLARE uid text;\n"
                "BEGIN\n"
                f'  SELECT id INTO uid FROM "User" WHERE email = {admin_email_literal};\n'
                "  IF uid IS NOT NULL THEN\n"
                '    DELETE FROM "AdminAuditLog" WHERE "actorUserId" = uid::text OR "entityId" = uid::text;\n'
                '    DELETE FROM "User" WHERE id = uid;\n'
                "  END IF;\n"
                "END $$;"
            )
            psql(sql)
            ok("cleanup temporary QA admin")
        except Exception as exc:
            skip("cleanup temporary QA admin", str(exc))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--admin-email",
        default=os.environ.get(
            "ATHR_QA_ADMIN_EMAIL",
            "admin@athar-online.com",
        ),
    )
    parser.add_argument(
        "--keep-data",
        action="store_true",
        help="Keep generated QA records instead of cleanup.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip typecheck/build and run only live E2E.",
    )
    args = parser.parse_args()

    print("ATHR FULL REGRESSION — pre-XPay gate")
    print("=" * 68)
    print("Uses MOCK payment and temporary QA-only records.")
    print("LOCAL ONLY: no production server/domain deployment is touched.")
    print("No passwords or Cloudinary secrets are printed.\n")

    started_services: dict[str, subprocess.Popen[bytes] | None] = {
        "api": None,
        "admin": None,
        "store": None,
    }

    run_id = f"{int(time.time())}-{uuid.uuid4().hex[:6]}"
    qa_admin_email = f"qa.admin.{run_id.replace('-', '.')}@example.com"
    qa_admin_password = f"Athr-QA-{uuid.uuid4().hex}!"

    try:
        if not args.skip_build:
            run_cmd("Prisma generate", ["npm", "run", "prisma:generate"])
            run_cmd("TypeScript typecheck", ["npm", "run", "typecheck"])
            run_cmd("Nest production build", ["npm", "run", "build:api"])

        bootstrap_qa_admin(qa_admin_email, qa_admin_password)

        # The QA runner owns local service readiness after compile/build.
        # Existing services are reused; only missing ports are started.
        started_services = ensure_local_stack()

        inspect = subprocess.run(
            [
                "docker",
                "inspect",
                "-f",
                "{{.State.Running}}",
                "athr-postgres",
            ],
            text=True,
            capture_output=True,
        )
        expect(
            inspect.returncode == 0 and inspect.stdout.strip() == "true",
            "PostgreSQL container running",
            inspect.stderr.strip(),
        )

        plain = Client()

        for path in [
            "/",
            "/shop.html",
            "/product.html",
            "/cart.html",
            "/checkout.html",
            "/auth.html",
            "/account.html",
            "/wishlist.html",
        ]:
            response = plain.request(
                "GET",
                f"{STORE}{path}",
                allow_error=True,
            )
            expect(
                response.status == 200,
                f"Storefront {path} HTTP 200",
                f"HTTP {response.status}",
            )

        admin_page = plain.request(
            "GET",
            f"{ADMIN_SITE}/",
            allow_error=True,
        )
        expect(
            admin_page.status == 200,
            "Admin frontend HTTP 200",
            f"HTTP {admin_page.status}",
        )

        # Wait for the compiled API to become ready before starting E2E checks.
        live = wait_for_json(plain, f"{API}/health/live")
        expect(live.get("status") == "ok", "API liveness")

        ready = wait_for_json(plain, f"{API}/health/ready")
        expect(
            ready.get("status") == "ready"
            and ready.get("database") == "ok",
            "API readiness + database",
        )
        expect(
            ready.get("cloudinary") == "configured",
            "Cloudinary configured",
            str(ready),
        )

        categories = get_json(plain, f"{API}/categories")
        expect(
            len(categories.get("items", [])) >= 1,
            "Public categories available",
        )

        products = get_json(plain, f"{API}/products?limit=48")
        expect(
            len(products.get("items", [])) >= 1,
            "Public products available",
        )

    except TestFailure as exc:
        fail("Preflight / live stack", str(exc))
        print("\nPreflight failed. Local stack could not become ready.")
        for label, process in reversed(list(started_services.items())):
            stop_local_service(label, process)
        print(f"\nPASS={PASSED}  FAIL={FAILED}  SKIP={SKIPPED}")
        return 1

    admin = Client()
    try:
        login = admin.request(
            "POST",
            f"{API}/admin/auth/login",
            json_body={
                "email": qa_admin_email,
                "password": qa_admin_password,
            },
        ).json()
    except TestFailure as exc:
        fail("Temporary QA admin login", str(exc))
        cleanup(
            admin,
            qa_email=None,
            qa_admin_email=qa_admin_email,
            product_id=None,
            category_id=None,
        )
        for label, process in reversed(list(started_services.items())):
            stop_local_service(label, process)
        print(f"\nPASS={PASSED}  FAIL={FAILED}  SKIP={SKIPPED}")
        return 1
    finally:
        qa_admin_password = ""

    expect(
        login.get("user", {}).get("role") == "SUPER_ADMIN",
        "Temporary QA admin login",
    )

    me = get_json(admin, f"{API}/admin/auth/me")
    expect(
        me.get("user", {}).get("email") == qa_admin_email,
        "Temporary QA admin session persists",
    )

    cloud = get_json(admin, f"{API}/admin/cloudinary/status")
    expect(
        cloud.get("configured") is True,
        "Admin Cloudinary status configured",
    )

    slug_suffix = re.sub(r"[^a-z0-9-]", "-", run_id.lower())
    cat_slug = f"qa-{slug_suffix}"
    product_slug = f"qa-book-{slug_suffix}"
    qa_email = f"qa.{run_id.replace('-', '.')}@example.com"
    qa_password = "Athr-QA-2026!"

    product_id: str | None = None
    category_id: str | None = None
    customer: Client | None = None
    e2e_completed = False

    try:
        cat = admin.request(
            "POST",
            f"{API}/admin/categories",
            json_body={
                "nameAr": "تصنيف اختبار آلي",
                "slug": cat_slug,
                "shortAr": "QA",
                "descriptionAr": "Temporary automated QA category",
                "isActive": True,
                "sortOrder": 9999,
            },
        ).json()["category"]
        category_id = cat["id"]
        expect(cat["slug"] == cat_slug, "Admin creates category")

        product = admin.request(
            "POST",
            f"{API}/admin/products",
            json_body={
                "slug": product_slug,
                "titleAr": "كتاب اختبار أثر الآلي",
                "subtitleAr": "منتج مؤقت لاختبار دورة الشراء الكاملة.",
                "descriptionAr": "QA temporary product",
                "categoryId": category_id,
                "price": 1.23,
                "currency": "SAR",
                "status": "PUBLISHED",
                "featured": False,
                "formatLabelAr": "PDF رقمي",
                "contentLabelAr": "اختبار آلي",
            },
        ).json()["product"]
        product_id = product["id"]
        expect(
            product["status"] == "PUBLISHED",
            "Admin creates published product",
        )

        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=="
        )
        body, content_type = multipart(
            {"altAr": "غلاف اختبار آلي"},
            "image",
            "qa-cover.png",
            "image/png",
            png,
        )
        cover = admin.request(
            "POST",
            f"{API}/admin/products/{product_id}/images/cover",
            data=body,
            headers={"Content-Type": content_type},
        ).json()["image"]
        expect(
            str(cover.get("secureUrl", "")).startswith("https://"),
            "Cloudinary cover upload",
        )

        pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n"
            b"trailer<</Root 1 0 R>>\n%%EOF\n"
        )
        body, content_type = multipart(
            {},
            "file",
            "athr-qa-book.pdf",
            "application/pdf",
            pdf,
        )
        digital = admin.request(
            "POST",
            f"{API}/admin/products/{product_id}/digital-file",
            data=body,
            headers={"Content-Type": content_type},
        ).json()["product"]
        expect(
            digital.get("digitalFileReady") is True,
            "Private PDF upload",
        )

        public_product = get_json(
            plain,
            f"{API}/products/{product_slug}",
        )
        public_product = public_product.get(
            "product",
            public_product,
        )
        expect(
            public_product.get("slug") == product_slug,
            "New product visible in public catalog",
        )
        expect(
            bool(public_product.get("coverImage")),
            "Public product exposes Cloudinary cover",
        )

        customer = Client()
        reg = customer.request(
            "POST",
            f"{API}/auth/register",
            json_body={
                "fullName": "ATHR QA Customer",
                "email": qa_email,
                "phone": "+201000000000",
                "password": qa_password,
            },
        ).json()
        expect(
            reg.get("user", {}).get("email") == qa_email,
            "Customer registration",
        )

        customer_me = get_json(customer, f"{API}/auth/me")
        expect(
            customer_me.get("user", {}).get("email") == qa_email,
            "Customer session persists",
        )

        wish_add = customer.request(
            "POST",
            f"{API}/wishlist/{product_slug}",
        ).json()
        expect(
            wish_add.get("ok") is True,
            "Wishlist add",
        )

        wish = get_json(customer, f"{API}/wishlist")
        expect(
            any(
                row.get("product", {}).get("slug") == product_slug
                for row in wish.get("items", [])
            ),
            "Wishlist persists in database",
        )

        news1 = customer.request(
            "POST",
            f"{API}/newsletter/subscribe",
            json_body={"email": qa_email},
        ).json()
        expect(
            news1.get("ok") is True,
            "Newsletter subscription",
        )

        news2 = customer.request(
            "POST",
            f"{API}/newsletter/subscribe",
            json_body={"email": qa_email},
        ).json()
        expect(
            news2.get("alreadySubscribed") is True,
            "Newsletter duplicate is idempotent",
        )

        quantity_rejected = customer.request(
            "POST",
            f"{API}/commerce/checkout/session",
            json_body={
                "items": [
                    {
                        "slug": product_slug,
                        "quantity": 2,
                    }
                ],
                "phone": "+201000000000",
            },
            allow_error=True,
        )
        expect(
            quantity_rejected.status == 400,
            "Checkout rejects quantity greater than one",
        )

        duplicate_rejected = customer.request(
            "POST",
            f"{API}/commerce/checkout/session",
            json_body={
                "items": [
                    {
                        "slug": product_slug,
                        "quantity": 1,
                    },
                    {
                        "slug": product_slug,
                        "quantity": 1,
                    },
                ],
                "phone": "+201000000000",
            },
            allow_error=True,
        )
        expect(
            duplicate_rejected.status == 400,
            "Checkout rejects duplicate digital product",
        )

        checkout = customer.request(
            "POST",
            f"{API}/commerce/checkout/session",
            json_body={
                "items": [
                    {
                        "slug": product_slug,
                        "quantity": 1,
                    }
                ],
                "phone": "+201000000000",
            },
        ).json()

        order = checkout["order"]
        expect(
            order["status"] == "PENDING_PAYMENT",
            "Checkout creates pending order",
        )
        expect(
            checkout.get("payment", {}).get("provider") == "MOCK",
            "Local payment provider is MOCK",
        )

        paid = customer.request(
            "POST",
            (
                f"{API}/commerce/payments/mock/"
                f"{urllib.parse.quote(order['orderNumber'])}/succeed"
            ),
        ).json()
        expect(
            paid.get("order", {}).get("status") == "PAID",
            "Mock payment marks order paid",
        )

        orders = get_json(customer, f"{API}/commerce/orders")
        expect(
            any(
                item.get("orderNumber") == order["orderNumber"]
                and item.get("status") == "PAID"
                for item in orders.get("items", [])
            ),
            "Paid order appears in customer orders",
        )

        library = get_json(customer, f"{API}/commerce/library")
        library_row = next(
            (
                row
                for row in library.get("items", [])
                if row.get("product", {}).get("slug") == product_slug
            ),
            None,
        )
        expect(
            library_row is not None,
            "Purchased product granted to library",
        )
        expect(
            library_row["product"].get("digitalFileReady") is True,
            "Library knows digital file is ready",
        )

        library_id = library_row["id"]

        anon_download = plain.request(
            "GET",
            f"{API}/commerce/library/{library_id}/download",
            allow_error=True,
        )
        expect(
            anon_download.status == 401,
            "Unauthorized download is blocked",
            f"HTTP {anon_download.status}",
        )

        download = customer.request(
            "GET",
            f"{API}/commerce/library/{library_id}/download",
            headers={"Accept": "application/pdf"},
        )
        expect(
            download.status == 200
            and download.body.startswith(b"%PDF"),
            "Authorized digital download works",
        )
        expect(
            "attachment"
            in str(
                download.headers.get(
                    "Content-Disposition",
                    "",
                )
            ).lower(),
            "Download uses attachment disposition",
        )
        expect(
            "no-store"
            in str(
                download.headers.get(
                    "Cache-Control",
                    "",
                )
            ).lower(),
            "Download disables public caching",
        )

        log_sql = (
            'SELECT COUNT(*) FROM "DownloadLog" d '
            'JOIN "User" u ON u.id=d."userId" '
            f"WHERE u.email={sql_quote(qa_email)};"
        )
        log_check = psql(log_sql)
        match = re.search(r"\n\s*(\d+)\s*\n", log_check.stdout)
        expect(
            bool(match and int(match.group(1)) >= 1),
            "Download audit log written",
        )

        dash = get_json(admin, f"{API}/admin/dashboard")
        expect(
            "stats" in dash,
            "Admin dashboard API",
        )

        admin_orders = get_json(admin, f"{API}/admin/orders")
        expect(
            any(
                item.get("orderNumber") == order["orderNumber"]
                for item in admin_orders.get("items", [])
            ),
            "Paid order visible to admin",
        )

        admin_news = get_json(admin, f"{API}/admin/newsletter")
        expect(
            any(
                row.get("email") == qa_email
                for row in admin_news.get("items", [])
            ),
            "Newsletter subscriber visible to admin",
        )

        logout = customer.request(
            "POST",
            f"{API}/auth/logout",
        ).json()
        expect(
            logout.get("ok") is True,
            "Customer logout",
        )

        me_after = customer.request(
            "GET",
            f"{API}/auth/me",
            allow_error=True,
        )
        expect(
            me_after.status == 401,
            "Logged-out customer session rejected",
        )

        e2e_completed = True
        ok("Full E2E scenario completed")

    except TestFailure as exc:
        fail("E2E regression", str(exc))
    except Exception as exc:
        fail(
            "Unexpected QA runner error",
            repr(exc),
        )
    finally:
        if args.keep_data:
            print("\nKeeping QA data (--keep-data).")
            print(f"QA email: {qa_email}")
            print(f"QA product slug: {product_slug}")
        else:
            cleanup(
                admin,
                qa_email=qa_email,
                qa_admin_email=qa_admin_email,
                product_id=product_id,
                category_id=category_id,
            )

    if not e2e_completed and FAILED == 0:
        fail(
            "E2E completion gate",
            "Regression exited before completing the full purchase/download scenario.",
        )

    for label, process in reversed(list(started_services.items())):
        stop_local_service(label, process)

    print("\n" + "=" * 68)
    print(f"PASS={PASSED}  FAIL={FAILED}  SKIP={SKIPPED}")

    if FAILED:
        print(f"{RED}ATHR QA RESULT: FAIL{RESET}")
        return 1

    print(f"{GREEN}ATHR QA RESULT: PASS{RESET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

(() => {
  function createPhoneInput(input, options = {}) {
    if (!input || typeof window.intlTelInput !== 'function') {
      throw new Error('تعذر تحميل أداة أرقام الهاتف الدولية. حدّث الصفحة وحاول مرة أخرى.');
    }

    if (options.initialNumber) input.value = options.initialNumber;

    const instance = window.intlTelInput(input, {
      initialCountry: String(options.initialCountry || 'SA').toLowerCase(),
      separateDialCode: true,
      countrySearch: true,
      countryNameLocale: 'ar',
      strictMode: true,
      uiTranslations: {
        selectedCountryAriaLabel: 'تغيير الدولة لرقم الهاتف، المحددة ${countryName} (${dialCode})',
        noCountrySelected: 'اختر دولة لرقم الهاتف',
        countryListAriaLabel: 'قائمة الدول',
        searchPlaceholder: 'ابحث عن دولة',
        clearSearchAriaLabel: 'مسح البحث',
        searchEmptyState: 'لم يتم العثور على نتائج',
      },
    });

    return {
      setNumber(value) {
        instance.setNumber(String(value || ''));
      },
      value() {
        const country =
          typeof instance.getSelectedCountry === 'function'
            ? instance.getSelectedCountry()
            : typeof instance.getSelectedCountryData === 'function'
              ? instance.getSelectedCountryData()
              : null;

        if (!country?.iso2 || !instance.isValidNumber()) {
          throw new Error('رقم الهاتف غير صالح للدولة المحددة.');
        }

        return {
          phone: instance.getNumber(),
          phoneCountry: country.iso2.toUpperCase(),
        };
      },
    };
  }

  window.ATHR_PHONE = { create: createPhoneInput };
})();

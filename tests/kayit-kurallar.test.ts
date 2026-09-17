import {
  type KayitGirdisi,
  kayitGirdisiniCoz,
  kullaniciAdiGecerliMi,
  tcKimlikNoGecerliMi,
} from "@/lib/kayit/kurallar";

/**
 * Kayıtla giriş kuralları (17 Eylül 2026).
 *
 * Sınanan şey hangi kaydın kabul edildiği: T.C. kimlik numarasının sağlaması,
 * tipe göre zorunlu alanlar ve şifre politikası.
 */

const SIMDI = new Date("2026-09-17T12:00:00+03:00");
/** Sağlama kuralına uyan, yaygın kullanılan örnek numara. */
const GECERLI_TC = "10000000146";

function girdi(degisiklik: Partial<KayitGirdisi> = {}): KayitGirdisi {
  return {
    tip: "OGRENCI",
    tcKimlikNo: GECERLI_TC,
    ad: "Elif",
    soyad: "Yılmaz",
    cinsiyet: "K",
    ilKodu: "34",
    kurumKodu: "750001",
    sinifSeviyesi: "11",
    sube: "a",
    brans: "",
    sifre: "guclu-parola-42",
    sifreTekrar: "guclu-parola-42",
    ...degisiklik,
  };
}

describe("T.C. kimlik numarası", () => {
  test("sağlaması tutan numara geçer", () => {
    expect(tcKimlikNoGecerliMi(GECERLI_TC)).toBe(true);
  });

  test.each([
    ["10 hane", "1000000014"],
    ["0 ile başlayan", "01000000146"],
    ["harf içeren", "1000000014a"],
    ["10. hane yanlış", "10000000156"],
    ["11. hane yanlış", "10000000147"],
  ])("%s reddedilir", (_ad, numara) => {
    expect(tcKimlikNoGecerliMi(numara)).toBe(false);
  });
});

describe("kayıt girdisi", () => {
  test("öğrenci kaydı sınıf ve şubeyle kabul edilir", () => {
    const karar = kayitGirdisiniCoz(girdi(), SIMDI);
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.sinif).toBe("11-A");
    expect(karar.kayit.brans).toBeNull();
    expect(karar.kayit.kurumKodu).toBe(750001);
    expect(karar.kayit.egitimOgretimYili).toBe("2026-2027");
  });

  test("şubesiz öğrenci kaydında sınıf yalnızca seviyedir", () => {
    const karar = kayitGirdisiniCoz(girdi({ sube: "" }), SIMDI);
    expect(karar.olurMu && karar.kayit.sinif).toBe("11");
  });

  test("boşluklu yazılan kimlik numarası normallenir", () => {
    const karar = kayitGirdisiniCoz(
      girdi({ tcKimlikNo: "100 000 001 46" }),
      SIMDI,
    );
    expect(karar.olurMu && karar.kayit.tcKimlikNo).toBe(GECERLI_TC);
  });

  test("öğretmen kaydı branşla kabul edilir, sınıf boş kalır", () => {
    const karar = kayitGirdisiniCoz(
      girdi({ tip: "OGRETMEN", brans: "Bilişim Teknolojileri" }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.sinif).toBeNull();
    expect(karar.kayit.brans).toBe("Bilişim Teknolojileri");
  });

  test.each<[string, Partial<KayitGirdisi>]>([
    ["tip seçilmemiş", { tip: "PERSONEL" }],
    ["kimlik numarası geçersiz", { tcKimlikNo: "12345678901" }],
    ["ad boş", { ad: "  " }],
    ["cinsiyet seçilmemiş", { cinsiyet: "" }],
    ["il seçilmemiş", { ilKodu: "" }],
    ["okul seçilmemiş", { kurumKodu: "" }],
    ["öğrencide sınıf yok", { sinifSeviyesi: "" }],
    ["öğrencide sınıf lise dışı", { sinifSeviyesi: "7" }],
    ["şube biçimsiz", { sube: "A1" }],
    ["öğretmende branş yok", { tip: "OGRETMEN", brans: "" }],
    ["şifre tekrarı farklı", { sifreTekrar: "baska-parola-42" }],
    ["şifre kısa", { sifre: "kisa", sifreTekrar: "kisa" }],
    [
      "şifre kimlik numarasını içeriyor",
      { sifre: `x${GECERLI_TC}`, sifreTekrar: `x${GECERLI_TC}` },
    ],
  ])("%s reddedilir", (_ad, degisiklik) => {
    expect(kayitGirdisiniCoz(girdi(degisiklik), SIMDI).olurMu).toBe(false);
  });
});

describe("yönetici kullanıcı adı", () => {
  test.each(["admin", "proje.yonetici", "yonetici-2"])("%s geçer", (ad) => {
    expect(kullaniciAdiGecerliMi(ad)).toBe(true);
  });

  test.each(["ad", "Admin", "1admin", "10000000146", "admin yonetici"])(
    "%s reddedilir",
    (ad) => {
      expect(kullaniciAdiGecerliMi(ad)).toBe(false);
    },
  );
});

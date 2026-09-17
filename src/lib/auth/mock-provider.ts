import { prisma } from "../db";
import { MOCK_KIMLIKLER, mockKimlikBul } from "./mock-kullanicilar";
import type { AuthKimlik, AuthProvider } from "./tipler";

/**
 * EBA SSO erişimi gelene kadar kullanılan sağlayıcı. Şifre veya kayıt akışı
 * yoktur; EBA da bunu yapmayacağı için taklit etmiyoruz. Giriş, katalogdan bir
 * test kullanıcısı seçmekten oluşur.
 *
 * İki kimlik kaynağı vardır:
 *   1. `mock-kullanicilar.ts` — dört yetki senaryosunu kuran elle yazılmış
 *      katalog. Değişmez, testlerin dayandığı küme budur.
 *   2. `scripts/ornek-veri.ts` ile üretilen hacim verisi. Bunlar koda değil
 *      veritabanına yazılır; sağlayıcı da oradan okur. Aksi halde üretilen 400
 *      kullanıcının hiçbiri sisteme giremezdi.
 *
 * Veritabanından okumak bu sağlayıcıya özeldir ve EBA'ya sızmaz: gerçek
 * sağlayıcıda kimlik kaynağı EBA'dır, `secilebilirKimlikler` de boş döner.
 */

const URETILEN_ONEKI = "uretilen-";

export const KIMLIK_ALANLARI = {
  authProviderId: true,
  ad: true,
  soyad: true,
  cinsiyet: true,
  kurumKodu: true,
  ilKodu: true,
  ilceKodu: true,
  sinif: true,
  brans: true,
  egitimOgretimYili: true,
} as const;

type KimlikSatiri = {
  authProviderId: string;
  ad: string;
  soyad: string;
  cinsiyet: string;
  kurumKodu: number | null;
  ilKodu: string | null;
  ilceKodu: string | null;
  sinif: string | null;
  brans: string | null;
  egitimOgretimYili: string;
};

/**
 * Veritabanı satırını AuthKimlik'e çevirir. Tip, sağlama akışının kullandığı
 * ayrımla aynı: sınıfı olan öğrenci, okulu olan öğretmen, ikisi de yoksa
 * merkez personeli.
 */
export function satiriKimligeCevir(satir: KimlikSatiri): AuthKimlik {
  const tip =
    satir.sinif !== null
      ? "OGRENCI"
      : satir.kurumKodu !== null || satir.brans !== null
        ? "OGRETMEN"
        : "PERSONEL";

  return {
    authProviderId: satir.authProviderId,
    tip,
    ad: satir.ad,
    soyad: satir.soyad,
    cinsiyet: satir.cinsiyet === "K" ? "K" : "E",
    kurumKodu: satir.kurumKodu,
    ilKodu: satir.ilKodu,
    ilceKodu: satir.ilceKodu,
    sinif: satir.sinif,
    brans: satir.brans,
    egitimOgretimYili: satir.egitimOgretimYili,
  };
}

async function uretilenKimlikBul(
  authProviderId: string,
): Promise<AuthKimlik | null> {
  if (!authProviderId.startsWith(URETILEN_ONEKI)) return null;

  const satir = await prisma.kullanici.findUnique({
    where: { authProviderId },
    select: KIMLIK_ALANLARI,
  });
  return satir ? satiriKimligeCevir(satir) : null;
}

export class MockAuthProvider implements AuthProvider {
  readonly saglayiciAdi = "mock";

  async girisYap(kimlikBilgisi: string): Promise<AuthKimlik | null> {
    return mockKimlikBul(kimlikBilgisi) ?? uretilenKimlikBul(kimlikBilgisi);
  }

  async kimlikGetir(authProviderId: string): Promise<AuthKimlik | null> {
    return mockKimlikBul(authProviderId) ?? uretilenKimlikBul(authProviderId);
  }

  /**
   * Senaryo katalogu + üretilmiş kullanıcıların TAMAMI.
   *
   * Burada kısıtlama yapılmaz: kaç kartın gösterileceği bir sunum kararıdır ve
   * giriş ekranına aittir (orada arama ve gösterim sınırı vardır). Sağlayıcının
   * işi hangi kimliklerin seçilebilir olduğunu söylemektir.
   */
  async secilebilirKimlikler(): Promise<AuthKimlik[]> {
    const uretilenler = await prisma.kullanici.findMany({
      where: { authProviderId: { startsWith: URETILEN_ONEKI } },
      select: KIMLIK_ALANLARI,
      orderBy: [{ ad: "asc" }, { soyad: "asc" }],
    });

    return [...MOCK_KIMLIKLER, ...uretilenler.map(satiriKimligeCevir)];
  }
}

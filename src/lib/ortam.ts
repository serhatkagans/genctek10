import { z } from "zod";

/**
 * Ortam değişkenleri — eksik veya hatalı yapılandırma uygulamayı AÇILIŞTA
 * durdurur. Yanlış yapılandırmayla ayakta kalan bir sistem, hatayı ilk gerçek
 * kullanıcı isteğinde gösterir; o noktada zaten geç kalınmıştır.
 */

/**
 * Üretimde kullanılması yasak varsayılan anahtar.
 *
 * Bu değerle imzalanan oturum çerezi taklit edilebilir: anahtar depoda ve
 * .env.example'da açıkça yazılıdır.
 */
const GELISTIRME_ANAHTARI = "gelistirme-ortami-icin-gecici-anahtar-degistirin";

const semaOrtam = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL tanımlı değil"),
  /**
   * "kayit" (17 Eylül 2026): EBA SSO gelene kadar öğrenci ve öğretmen giriş
   * ekranından kendi kaydını açar, T.C. kimlik no + şifreyle girer
   * (bkz. auth/kayit-provider.ts). Kimlik seçerek giriş bu kipte kapalıdır.
   */
  AUTH_PROVIDER: z.enum(["mock", "eba", "kayit"]).default("mock"),

  /**
   * Üretimde mock girişe bilinçli onay.
   *
   * `AUTH_PROVIDER` varsayılanı "mock"tur ve mock sağlayıcı ŞİFRESİZDİR:
   * katalogdan kimlik seçmek girişin tamamıdır (bkz. auth/mock-provider.ts).
   * Değişkeni set etmeden üretime çıkan bir kurulumda herkes il koordinatörü
   * olarak girebilirdi — güvenliğin unutulmuş bir ortam değişkenine bağlı
   * olması kabul edilemez.
   *
   * NİYE YASAK DEĞİL DE ONAYA TABİ: EBA sağlayıcısı henüz `throw` ediyor
   * (auth/eba-provider.ts). Mock'u üretimde tamamen yasaklamak, sistemin hiç
   * ayağa kalkmaması demekti. Bu yüzden tehlikeli durum engellenmiyor, YALNIZCA
   * BİLİNÇLİ HÂLE GETİRİLİYOR: kuran kişi riski üstlendiğini açıkça yazmalı.
   * EBA entegrasyonu tamamlandığında bu değişken de kalkmalıdır.
   */
  URETIMDE_MOCK_GIRISE_IZIN_VER: z.enum(["evet", "hayir"]).default("hayir"),

  /**
   * Uygulamanın hizmet verdiği host adları (virgülle ayrık, ör.
   * "genctek.meb.gov.tr,www.genctek.meb.gov.tr").
   *
   * NİYE VAR: parola sıfırlama bağlantısının adresi istek başlıklarından
   * türetilir (bkz. app/sifre-sifirlama/eylemler.ts) ve `Host` /
   * `X-Forwarded-Host` başlıklarını İSTEMCİ belirler. Ters vekil bu başlığı
   * ezmiyorsa, saldırgan kurbanın e-postasına kendi alan adına giden bir
   * sıfırlama bağlantısı göndertebilir; kurban tıkladığında jeton saldırgana
   * ulaşır. Liste, türetilen host'un doğrulanacağı tek referanstır.
   *
   * BU, "UYGULAMA ADRESİ" AYARI DEĞİLDİR: yol bilgisi hâlâ TEMEL_YOL'dan
   * (uygulamaYolu) gelir, burada yalnızca host doğrulanır. İkisi ayrı kaldığı
   * için alt dizin kurulumunda çift yapılandırma riski doğmaz.
   *
   * Boş bırakılırsa doğrulama yapılmaz — geliştirmede localhost'un portu sık
   * değişir. Üretimde ZORUNLUDUR.
   */
  IZINLI_HOSTLAR: z.string().default(""),
  /**
   * Uygulamanın önünde duran ve `x-forwarded-for` başlığına kendi gördüğü
   * adresi EKLEYEN vekil sayısı.
   *
   * NİYE AYAR: istemcinin gerçek adresi zincirin sonundan sayılarak bulunur ve
   * kaçıncı sıradan sayılacağı kurulumun şekline bağlıdır (bkz.
   * guvenlik/istemci-ip.ts). Değer fazla verilirse adres bulunamaz ve istekler
   * "bilinmeyen" kovasına düşer; EKSİK verilirse istemcinin uydurduğu adres
   * gerçek sanılır — asıl kaçınılan budur, o yüzden şüphede kalındığında değer
   * BÜYÜK tutulmalıdır.
   *
   * Varsayılan 1: hem dagitim/nginx-genctek.conf hem aiotechs.cloud'daki
   * Apache kurulumu (DAGITIM.md Bölüm 13) uygulamanın önünde tek vekil
   * bırakıyor. Uygulama doğrudan internete açıksa 0 yazın — o zaman iletilen
   * başlıkların hiçbirine güvenilmez.
   */
  GUVENILEN_VEKIL_SAYISI: z.coerce
    .number()
    .int()
    .min(0, "GUVENILEN_VEKIL_SAYISI eksi olamaz")
    .default(1),

  OTURUM_GIZLI_ANAHTARI: z
    .string()
    .min(16, "OTURUM_GIZLI_ANAHTARI en az 16 karakter olmalı"),
  DEPOLAMA_SAGLAYICI: z.enum(["yerel", "s3"]).default("yerel"),
  DEPOLAMA_YEREL_DIZIN: z.string().default("./depolama"),

  /**
   * Uygulamanın kök dizini. Kendi alan adına kurulduğunda boş kalır; bir alt
   * dizine kurulduğunda (ör. https://ornek.gov.tr/genctek) "/genctek" olur.
   *
   * DERLEME ZAMANINDA da okunur (next.config.ts · basePath): değeri
   * değiştirdiğinizde yeniden derlemek ZORUNLUDUR, yoksa varlık adresleri eski
   * kökü işaret eder. Ayrıca oturum çerezinin yolunu belirler — alan adını
   * başka uygulamalarla paylaşırken çerez onlara sızmasın diye.
   */
  TEMEL_YOL: z
    .string()
    .default("")
    .refine(
      (deger) => deger === "" || /^\/[A-Za-z0-9._~-]+$/.test(deger),
      'TEMEL_YOL ya boş olmalı ya da "/genctek" gibi tek parçalı, eğik çizgiyle başlayan ve sonu eğik çizgisiz bir yol olmalı',
    ),

  // S3 uyumlu depolama; yalnızca DEPOLAMA_SAGLAYICI="s3" iken aranır.
  S3_UC_NOKTASI: z.string().optional(),
  S3_BOLGE: z.string().optional(),
  S3_KOVA: z.string().optional(),
  S3_ERISIM_ANAHTARI: z.string().optional(),
  S3_GIZLI_ANAHTAR: z.string().optional(),

  // EBA SSO; yalnızca AUTH_PROVIDER="eba" iken aranır.
  EBA_SSO_URL: z.string().optional(),
  EBA_ISTEMCI_ID: z.string().optional(),
  EBA_ISTEMCI_SIFRE: z.string().optional(),

  /**
   * E-posta bildirimi. Varsayılan "gunluk": ileti gönderilmez, sunucu
   * günlüğüne yazılır. Yanlış yapılandırmayla gerçek öğrencilere posta
   * gitmesindense hiç gitmemesi yeğdir.
   */
  EPOSTA_SAGLAYICI: z.enum(["kapali", "gunluk", "smtp"]).default("gunluk"),
  EPOSTA_GONDEREN: z.string().optional(),
  SMTP_SUNUCU: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_KULLANICI: z.string().optional(),
  SMTP_SIFRE: z.string().optional(),

  /**
   * SMS bildirimi. Varsayılan "kapali" — e-postadan farklı olarak "gunluk"
   * bile değil. SMS ücretli, geri alınamaz ve alıcılarının çoğu 18 yaş altı;
   * bu kanalın yanlışlıkla açık kalması, kapalı kalmasından pahalıdır.
   */
  SMS_SAGLAYICI: z.enum(["kapali", "gunluk", "http"]).default("kapali"),
  SMS_API_URL: z.string().optional(),
  SMS_API_ANAHTARI: z.string().optional(),
  /** Operatörde tanımlı gönderen başlığı (ör. "MEB"). */
  SMS_BASLIK: z.string().optional(),
});

const sonuc = semaOrtam.safeParse(process.env);

if (!sonuc.success) {
  const eksikler = sonuc.error.issues
    .map((sorun) => `  - ${sorun.path.join(".")}: ${sorun.message}`)
    .join("\n");
  throw new Error(`Ortam değişkenleri hatalı:\n${eksikler}`);
}

const veri = sonuc.data;

/*
 * `next build` de NODE_ENV=production ile çalışır ama o bir çalışma zamanı
 * değildir: derleme yapan makinede üretim sırlarının bulunmasını şart koşmak,
 * sırları derleme ortamına taşımaya zorlardı. Üretim kontrolleri yalnızca
 * gerçekten sunucu ayaktayken uygulanır.
 */
const derlemeAsamasiMi = process.env.NEXT_PHASE === "phase-production-build";
const uretimMi = process.env.NODE_ENV === "production" && !derlemeAsamasiMi;

/*
 * Koşullu zorunluluklar şemada değil burada: bir alanın gerekliliği başka bir
 * alanın değerine bağlı olduğunda, hata mesajının hangi seçim yüzünden
 * çıktığını söylemesi gerekir.
 */
const yapilandirmaHatalari: string[] = [];

if (uretimMi && veri.OTURUM_GIZLI_ANAHTARI === GELISTIRME_ANAHTARI) {
  yapilandirmaHatalari.push(
    "OTURUM_GIZLI_ANAHTARI hâlâ örnek değerde. Üretimde mutlaka değiştirin:\n" +
      '      node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

if (
  uretimMi &&
  veri.AUTH_PROVIDER === "mock" &&
  veri.URETIMDE_MOCK_GIRISE_IZIN_VER !== "evet"
) {
  yapilandirmaHatalari.push(
    'AUTH_PROVIDER="mock" ile üretime çıkılıyor. Mock giriş ŞİFRESİZDİR:\n' +
      "      giriş ekranındaki listeden herhangi bir kimlik seçen herkes o kişi\n" +
      "      olarak (il koordinatörü dahil) sisteme girer.\n" +
      '      Çözüm: EBA erişimi geldiyse AUTH_PROVIDER="eba" yapın.\n' +
      "      Kapalı bir ağda bilerek mock ile çalışıyorsanız riski üstlendiğinizi\n" +
      '      yazın: URETIMDE_MOCK_GIRISE_IZIN_VER="evet"',
  );
}

if (uretimMi && veri.IZINLI_HOSTLAR.trim() === "") {
  yapilandirmaHatalari.push(
    "IZINLI_HOSTLAR tanımlı değil (üretimde zorunlu). Uygulamanın hizmet\n" +
      "      verdiği host adlarını virgülle ayırarak yazın:\n" +
      '      IZINLI_HOSTLAR="genctek.meb.gov.tr"\n' +
      "      Bu liste olmadan parola sıfırlama bağlantısı, isteği yapanın\n" +
      "      belirlediği bir alan adına üretilebilir.",
  );
}

if (veri.DEPOLAMA_SAGLAYICI === "s3") {
  for (const anahtar of [
    "S3_UC_NOKTASI",
    "S3_KOVA",
    "S3_ERISIM_ANAHTARI",
    "S3_GIZLI_ANAHTAR",
  ] as const) {
    if (!veri[anahtar]) {
      yapilandirmaHatalari.push(
        `${anahtar} tanımlı değil (DEPOLAMA_SAGLAYICI="s3" seçildiğinde zorunlu).`,
      );
    }
  }
}

if (veri.AUTH_PROVIDER === "eba") {
  for (const anahtar of [
    "EBA_SSO_URL",
    "EBA_ISTEMCI_ID",
    "EBA_ISTEMCI_SIFRE",
  ] as const) {
    if (!veri[anahtar]) {
      yapilandirmaHatalari.push(
        `${anahtar} tanımlı değil (AUTH_PROVIDER="eba" seçildiğinde zorunlu).`,
      );
    }
  }
}

if (veri.EPOSTA_SAGLAYICI === "smtp") {
  for (const anahtar of ["SMTP_SUNUCU", "EPOSTA_GONDEREN"] as const) {
    if (!veri[anahtar]) {
      yapilandirmaHatalari.push(
        `${anahtar} tanımlı değil (EPOSTA_SAGLAYICI="smtp" seçildiğinde zorunlu).`,
      );
    }
  }
}

if (veri.SMS_SAGLAYICI === "http") {
  for (const anahtar of ["SMS_API_URL", "SMS_API_ANAHTARI"] as const) {
    if (!veri[anahtar]) {
      yapilandirmaHatalari.push(
        `${anahtar} tanımlı değil (SMS_SAGLAYICI="http" seçildiğinde zorunlu).`,
      );
    }
  }
}

if (yapilandirmaHatalari.length > 0) {
  throw new Error(
    `Ortam değişkenleri hatalı:\n${yapilandirmaHatalari
      .map((satir) => `  - ${satir}`)
      .join("\n")}`,
  );
}

export const ortam = veri;

/**
 * Çerezlerin geçerli olduğu yol.
 *
 * Uygulama bir alt dizine kurulduğunda çerez yolu da oraya daraltılır. Aksi
 * halde aynı alan adındaki diğer uygulamalar (ör. /baska-uygulama) her istekte
 * GençTek oturum çerezini de alır — oturum jetonu ilgisiz yazılımlara sızar.
 */
export const CEREZ_YOLU = veri.TEMEL_YOL === "" ? "/" : veri.TEMEL_YOL;

/**
 * İzin verilen host adları, karşılaştırmaya hazır hâlde.
 *
 * Küçük harfe çevrilir: host başlığında büyük/küçük harf ayrımı yoktur ve
 * "GencTek.meb.gov.tr" yazan bir istek doğrulamayı geçmeliydi.
 */
export const IZINLI_HOST_LISTESI: readonly string[] = veri.IZINLI_HOSTLAR.split(
  ",",
)
  .map((host) => host.trim().toLowerCase())
  .filter((host) => host !== "");

/**
 * Uygulama içi mutlak bir yolu, alt dizin kurulumuna göre düzeltir.
 *
 * NE ZAMAN GEREKLİ: yalnızca HAM HTML özniteliklerinde — `<img src>`,
 * `<a href>`, `<form action>`. Next.js'in `<Link>` bileşeni ve `redirect()`
 * basePath'i KENDİSİ ekler; oralarda bu fonksiyonu kullanmayın, yol iki kez
 * öneklenir.
 *
 * NEDEN VAR: uygulama `aiotechs.cloud/genctek` gibi bir alt dizine kurulduğunda
 * `/panel/...` yazan ham bir öznitelik tarayıcıyı alan adının köküne gönderir.
 * Orada uygulama yoktur; istek ters vekile düşer ve kullanıcı Next.js'in değil
 * Apache'nin 404 sayfasını görür — hangi bağlantının bozuk olduğunu söylemeyen,
 * teşhisi zor bir hata. Bu hatayı iki ayrı yerde ürettik: "Koordinatör ata"
 * bağlantısı ve faaliyet görselleri.
 */
export function uygulamaYolu(yol: string): string {
  if (veri.TEMEL_YOL === "") return yol;
  // Çift önek koruması: zaten öneklenmiş bir yol ikinci kez öneklenmemeli.
  if (yol === veri.TEMEL_YOL || yol.startsWith(`${veri.TEMEL_YOL}/`)) {
    return yol;
  }
  return `${veri.TEMEL_YOL}${yol}`;
}

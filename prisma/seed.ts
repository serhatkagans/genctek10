import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  MOCK_KOORDINATOR_KIMLIKLERI,
  MOCK_PROJE_YONETICISI_KIMLIKLERI,
  mockKimlikBul,
} from "../src/lib/auth/mock-kullanicilar";
import { ILLER, ORNEK_ILCELER, ORNEK_KURUMLAR } from "./veri/iller";

/**
 * Seed — referans veriler, çalışma grupları, sistem ayarları, bildirim
 * şablonları ve sistemin başlangıç yöneticisi.
 *
 * Yeniden çalıştırılabilir (idempotent): tüm kayıtlar upsert edilir.
 *
 * Öğrenci ve öğretmen kullanıcıları BURADA oluşturulmaz; ilk girişte kullanıcı
 * sağlama akışıyla oluşurlar. İstisna, elle atanması gereken roller: proje
 * yöneticileri ve il koordinatörleri olmadan sistem çalışmaya başlayamaz
 * (il koordinatörünü yalnızca proje yöneticisi atar).
 *
 * Proje yöneticisi listesi katalogdan gelir ve seed onu OTORİTE kabul eder:
 * listeden çıkarılan kişinin rolü kapatılır, kaydı pasife alınır. Silinmez —
 * açtığı faaliyetler ve erişim logları ona bağlıdır.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CALISMA_GRUPLARI = [
  "Oyun Tasarımı",
  "Siber Güvenlik",
  "Bilgisayar Olimpiyatları",
  "Mobil Programlama",
  "Web Programlama",
  "Havacılık Sistemleri",
  "Robotik",
  "Yapay Zekâ",
  "E-Ticaret ve E-İhracat",
  "Dijital Sanatlar ve İçerik Geliştirme",
  "Açık Kaynak",
  "Espor",
  "Bilişim Hukuku",
  "Güvenli İnternet",
  "GençX",
  /*
   * "Diğer" listenin SONUNDA: başta olsaydı öğrenci diğer alanları okumadan
   * onu seçerdi. Grup adları seed'de tutuluyor çünkü panelden eklenen bir grup
   * yalnızca o ortamın veritabanına yazılır ve başka bir kuruluma taşınmaz.
   */
  "Diğer",
];

/**
 * Temel Etkinlik ve Çalışma Grubu Etkinliği programları — adları SABİTTİR.
 *
 * Bu liste ilk aktarımdır; tam liste geldiğinde buraya eklenir. İl Etkinliği
 * burada YOKTUR: il koordinatörü faaliyet adını serbestçe girer, sabit bir
 * isim listesi tutulmaz.
 */
const TEMEL_ETKINLIK_PROGRAMLARI: {
  ad: string;
  grup: "TEMEL_ETKINLIK" | "CALISMA_GRUBU_ETKINLIGI";
}[] = [
  { ad: "Genç Gölge", grup: "TEMEL_ETKINLIK" },
  { ad: "Sahne Senin", grup: "TEMEL_ETKINLIK" },
  { ad: "G2S Genç Sektör Buluşmaları", grup: "TEMEL_ETKINLIK" },
  { ad: "Sınır Ötesi (Beyond The Borders)", grup: "TEMEL_ETKINLIK" },
  { ad: "Öğrenci Forumu", grup: "TEMEL_ETKINLIK" },
  { ad: "Hack The Idea", grup: "TEMEL_ETKINLIK" },
  { ad: "Akran Öğretimi", grup: "TEMEL_ETKINLIK" },
  { ad: "Dijital Yürüyüş STEM", grup: "TEMEL_ETKINLIK" },
  { ad: "Oyunun e Hâli", grup: "TEMEL_ETKINLIK" },
  { ad: "Tek Maraton", grup: "TEMEL_ETKINLIK" },
  { ad: "Misafir Öğretmenlik/Öğrencilik", grup: "TEMEL_ETKINLIK" },
  { ad: "GençTek Zirvesi", grup: "TEMEL_ETKINLIK" },
  { ad: "EğitiJAM", grup: "CALISMA_GRUBU_ETKINLIGI" },
  { ad: "Capture The Flag (Bayrağı Yakala)", grup: "CALISMA_GRUBU_ETKINLIGI" },
  {
    ad: "Mobil Uygulama Geliştirme Yarışması",
    grup: "CALISMA_GRUBU_ETKINLIGI",
  },
  { ad: "Teknik Gezi", grup: "CALISMA_GRUBU_ETKINLIGI" },
  { ad: "Master Tek", grup: "CALISMA_GRUBU_ETKINLIGI" },
  { ad: "E-Ticaret Ideathonu", grup: "CALISMA_GRUBU_ETKINLIGI" },
];

/*
 * OGRENCI_CALISMA_GRUBU_UST_SINIRI burada YOKTUR: öğrenci başına çalışma grubu
 * seçim sınırı kaldırıldı. Anahtarı geri eklemeyin; migration mevcut kaydı da
 * siliyor.
 */
const SISTEM_AYARLARI = [
  {
    anahtar: "GORSEL_MAKS_BAYT",
    deger: String(5 * 1024 * 1024),
    aciklama: "Etkinliğe eklenecek görsel başına üst sınır (varsayım: 5 MB).",
  },
  {
    anahtar: "BELGE_MAKS_BAYT",
    deger: String(10 * 1024 * 1024),
    aciklama: "Etkinliğe eklenecek belge başına üst sınır (varsayım: 10 MB).",
  },
  {
    anahtar: "IZINLI_GORSEL_TIPLERI",
    deger: "image/jpeg,image/png,image/webp",
    aciklama: "Yüklenebilir görsel MIME tipleri.",
  },
  {
    anahtar: "IZINLI_BELGE_TIPLERI",
    deger: "application/pdf",
    aciklama: "Yüklenebilir belge MIME tipleri.",
  },
  {
    // Faaliyet eklerinin belge ayarından AYRI TUTULDU: bugün ikisi de yalnızca
    // PDF kabul ediyor ama biri için açılacak bir tip (ör. faaliyet ekine
    // görsel) kendiliğinden özgeçmişte de açılmamalı.
    //
    // YALNIZCA PDF (11 Ağustos 2026): doc ve docx kapatıldı. Kurulu
    // veritabanlarında bu satırın `deger` alanına dokunulmadığı için değişiklik
    // migration ile de yazıldı (20260811150000_cv_yalnizca_pdf).
    anahtar: "IZINLI_CV_TIPLERI",
    deger: "application/pdf",
    aciklama:
      "Özgeçmiş olarak yüklenebilecek MIME tipleri. Yalnızca PDF (11 Ağustos 2026).",
  },
  {
    anahtar: "CV_MAKS_BAYT",
    deger: String(5 * 1024 * 1024),
    aciklama: "Öğrenci CV'si için üst boyut sınırı (varsayım: 5 MB).",
  },
  {
    // Faaliyet görseli ayarından AYRIDIR, CV ile aynı gerekçeyle: faaliyet
    // görselleri için açılan bir tip kendiliğinden herkesin avatarında da
    // geçerli olmamalı.
    anahtar: "IZINLI_PROFIL_FOTO_TIPLERI",
    deger: "image/jpeg,image/png,image/webp",
    aciklama: "Profil fotoğrafı olarak yüklenebilecek MIME tipleri.",
  },
  {
    anahtar: "PROFIL_FOTO_MAKS_BAYT",
    deger: String(2 * 1024 * 1024),
    aciklama:
      "Profil fotoğrafı için üst boyut sınırı (varsayım: 2 MB). Avatar küçük gösterildiği için CV'den düşük tutulur.",
  },
  {
    anahtar: "ERISIM_LOGU_SAKLAMA_AYI",
    deger: "24",
    aciklama:
      "Erişim kayıtlarının saklanma süresi (ay). Süresi dolanlar bakim:saklama işiyle silinir.",
  },
  {
    anahtar: "BILDIRIM_SAKLAMA_AYI",
    deger: "12",
    aciklama:
      "Okunmuş bildirimlerin saklanma süresi (ay). Okunmamış bildirim silinmez.",
  },
  {
    anahtar: "HAREKETSIZ_KULLANICI_AYI",
    deger: "24",
    aciklama:
      "Kişi sistemle bu kadar süre temas etmezse (giriş ya da e-Okul/EBA eşitlemesi) kişisel verisi bakim:saklama işiyle anonim hâle getirilir. Çıpa mezuniyet DEĞİL son temastır: sistemde ilişik kesme olayı yok.",
  },
  {
    anahtar: "GIZLI_ICERIK_SAKLAMA_AYI",
    deger: "6",
    aciklama:
      "Moderasyonla gizlenen içeriğin metni bu süre sonunda imha edilir; kimin ne zaman gizlediği kaydı kalır. Gizleme tek başına imha sayılmaz.",
  },
  {
    anahtar: "DISA_AKTARMA_UST_SINIRI",
    deger: "5000",
    aciklama:
      "Tek CSV indirmesindeki azami kayıt sayısı. Aşıldığında indirme yapılmaz, filtre daraltılması istenir.",
  },
];

const BILDIRIM_SABLONLARI = [
  {
    kod: "BASVURU_SONUCU",
    konu: "{{faaliyetAdi}} başvurunuz sonuçlandı",
    govdeSablonu:
      "Merhaba {{ogrenciAdSoyad}},\n\n{{faaliyetAdi}} etkinliğine yaptığınız başvurunun sonucu: {{sonuc}}.\n\nGençTek",
  },
  {
    kod: "DANISMAN_DEGISTI",
    konu: "Danışman öğretmeniniz değişti",
    govdeSablonu:
      "Merhaba,\n\nGençTek danışman öğretmeniniz güncellendi. Yeni danışmanınızı profil sayfanızdan görebilirsiniz.\n\nGençTek",
  },
  {
    kod: "DANISMAN_YENIDEN_SECIM",
    konu: "Danışman öğretmeninizi yeniden seçmeniz gerekiyor",
    govdeSablonu:
      "Merhaba,\n\nDanışman öğretmeniniz okulunuzdan ayrıldı. Okulunuzda birden fazla danışman öğretmen bulunduğu için yeni danışmanınızı sizin seçmeniz gerekiyor. Seçim yapana kadar il koordinatörünüze bağlı görünürsünüz.\n\nGençTek",
  },
  {
    kod: "DANISMANLIK_TEKIL_BIRAKILDI",
    konu: "{{ogrenciAdSoyad}} öğrencisinin danışmanlığı bırakıldı",
    govdeSablonu:
      "Merhaba,\n\n{{okulAdi}} okulundan {{danismanAdSoyad}}, {{ogrenciAdSoyad}} adlı öğrencinin danışmanlığını bıraktı.\n\nGerekçe: {{gerekce}}\n\nÖğrencinin yeni durumu: {{yeniDurum}}\n\nGençTek",
  },
  {
    kod: "OGRENCI_DANISMAN_SECTI",
    konu: "{{ogrenciAdSoyad}} sizi danışman öğretmen olarak seçti",
    govdeSablonu:
      "Merhaba,\n\n{{ogrenciAdSoyad}} ({{sinif}}) adlı öğrenci, GençTek danışman öğretmeni olarak sizi seçti. Öğrenci artık \"Öğrencilerim\" listenizde görünüyor.\n\nGençTek",
  },
  {
    kod: "DANISMAN_TALEBI_GELDI",
    konu: "{{ogrenciAdSoyad}} danışmanı olmanızı istiyor",
    govdeSablonu:
      "Merhaba,\n\n{{ogrenciAdSoyad}} ({{sinif}}) adlı öğrencinin şu anda bir danışman öğretmeni var ve danışmanını sizinle değiştirmek istiyor.\n\nTalep onayınızı bekliyor: \"Öğrencilerim\" ekranının başındaki listeden onaylayabilir ya da gerekçesiyle reddedebilirsiniz. Karar verilene kadar öğrencinin mevcut danışmanı değişmez.\n\nGençTek",
  },
  {
    kod: "DANISMAN_TALEBI_ONAYLANDI",
    konu: "Danışman değişikliğiniz onaylandı",
    govdeSablonu:
      "Merhaba,\n\nDanışman öğretmeninizin {{danismanAdSoyad}} olarak değiştirilmesi talebiniz onaylandı.\n\nGençTek",
  },
  {
    kod: "DANISMAN_TALEBI_REDDEDILDI",
    konu: "Danışman değişikliğiniz reddedildi",
    govdeSablonu:
      "Merhaba,\n\n{{danismanAdSoyad}} öğretmeni danışmanınız olarak seçme talebiniz reddedildi. Mevcut danışmanınız değişmedi.\n\nGerekçe: {{gerekce}}\n\nGençTek",
  },
  {
    kod: "OGRENCI_DANISMANLIKTAN_AYRILDI",
    konu: "{{ogrenciAdSoyad}} danışmanlığınızdan ayrıldı",
    govdeSablonu:
      "Merhaba,\n\n{{ogrenciAdSoyad}} adlı öğrenci {{neOldu}}. Öğrenci artık \"Öğrencilerim\" listenizde görünmeyecek.\n\nGençTek",
  },
  {
    kod: "KOORDINATOR_DEVREDILEBILIR_OGRENCI",
    konu: "{{okulAdi}} için devredilebilir öğrenci var",
    govdeSablonu:
      "Merhaba,\n\n{{okulAdi}} okulunda GençTek danışman öğretmeni görev aldı. Size bağlı {{ogrenciSayisi}} öğrenci bu öğretmene devredilebilir. Devri onaylamak için panelinizi ziyaret edin.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_ULUSAL_FAALIYET",
    konu: "Onay bekleyen ulusal etkinlik: {{faaliyetAdi}}",
    govdeSablonu:
      "Merhaba,\n\n{{duzenleyenAdSoyad}} tarafından {{faaliyetAdi}} adlı ulusal etkinlik oluşturuldu ve onayınızı bekliyor.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_OGRENCI_FAALIYETI",
    konu: "Öğrenci etkinliği onayınızı bekliyor: {{faaliyetAdi}}",
    govdeSablonu:
      "Merhaba,\n\n{{okulAdi}} okulundan {{duzenleyenAdSoyad}}, {{kapsam}} kapsamında {{faaliyetAdi}} adlı etkinliği önerdi ve onay bekliyor.\n\nBu öneriyi hem siz hem de YEĞİTEK proje yöneticileri onaylayabilir; ilk verilen karar geçerlidir. Etkinlik, onaylanana kadar öğrencilere görünmez.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_OGRETMEN_FAALIYETI",
    konu: "Öğretmen etkinliği onayınızı bekliyor: {{faaliyetAdi}}",
    govdeSablonu:
      "Merhaba,\n\n{{okulAdi}} okulundan {{duzenleyenAdSoyad}}, {{kapsam}} kapsamında {{faaliyetAdi}} adlı etkinliği açtı ve onayınızı bekliyor.\n\nEtkinlik, onaylanana kadar öğrencilere görünmez ve başvuru almaz.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_DIS_KULLANICI_ETKINLIGI",
    konu: "{{sifat}} etkinliği onayınızı bekliyor: {{faaliyetAdi}}",
    govdeSablonu:
      "Merhaba,\n\n{{duzenleyenAdSoyad}} ({{sifat}}), {{kapsam}} kapsamında {{faaliyetAdi}} adlı etkinliği bildirdi ve onay bekliyor.\n\nBu öneriyi hem siz hem de YEĞİTEK proje yöneticileri onaylayabilir; ilk verilen karar geçerlidir. Etkinlik, onaylanana kadar kimseye görünmez ve başvuru almaz.\n\nGençTek",
  },
  {
    kod: "IL_DISI_BASVURU_KARARI",
    konu: "{{faaliyetAdi}} başvurunuz iliniz tarafından {{sonuc}}",
    govdeSablonu:
      "Merhaba {{ogrenciAdSoyad}},\n\nBaşka bir ildeki {{faaliyetAdi}} etkinliğine yaptığınız başvuru, il koordinatörünüz tarafından {{sonuc}}.\n\nGerekçe: {{gerekce}}\n\nOnaylandıysa başvurunuz bitmiş değildir: sıra etkinliğin yapıldığı ildeki değerlendirmeye geçer, sonucu ayrıca bildirilir.\n\nGençTek",
  },
  {
    kod: "TOPLU_DUYURU",
    konu: "{{baslik}}",
    govdeSablonu: "{{icerik}}",
  },
  {
    kod: "ONAY_BEKLEYEN_BAGLANTI",
    konu: "Bağlantı isteği onayınızı bekliyor",
    govdeSablonu:
      "Merhaba,\n\n{{isteyenAdSoyad}}, {{hedefAdSoyad}} ile iletişim kurmak istiyor ({{talepBasligi}}).\n\nPanelden inceleyip onaylayabilir ya da gerekçesiyle reddedebilirsiniz. Onaylanana kadar taraflar birbirine ulaşamaz.\n\nGençTek",
  },
  {
    kod: "EKIPTE_YENI_MESAJ",
    konu: "{{ekipAdi}} ekibinde yeni mesaj",
    govdeSablonu:
      'Merhaba,\n\n"{{ekipAdi}}" ekibinin sohbetine yeni mesaj yazıldı. Okumak için bildirimdeki bağlantıyı kullanabilir ya da Ekiplerim kartından ekibe girebilirsiniz.\n\nGençTek',
  },
  {
    kod: "EKIBE_EKLENDINIZ",
    konu: "{{ekipAdi}} ekibine eklendiniz",
    govdeSablonu:
      'Merhaba,\n\n{{ekleyenAdSoyad}} sizi "{{ekipAdi}}" ekibine ekledi. Ekip sohbetine Panel\'deki Ekiplerim kartından ulaşabilirsiniz.\n\nEkip sohbeti gizli değildir: ekibi kuran il koordinatörü ve proje yöneticisi mesajları okuyabilir.\n\nGençTek',
  },
  {
    kod: "TALEBE_CEVAP_GELDI",
    konu: "Panodaki ilanınıza cevap geldi",
    govdeSablonu:
      'Merhaba,\n\n"{{talepBasligi}}" başlıklı ilanınıza {{cevaplayanAdSoyad}} cevap yazdı. Cevabı panodaki ilanınızın altında okuyabilirsiniz.\n\nGençTek',
  },
  {
    kod: "BAGLANTI_ISTEGI_KARARI",
    konu: "Bağlantı isteğiniz {{sonuc}}",
    govdeSablonu:
      "Merhaba,\n\n{{hedefAdSoyad}} ile iletişim kurma isteğiniz {{sonuc}}.\n\nGerekçe: {{gerekce}}\n\nOnaylandıysa yazışma sayfanızdan mesajlaşmaya başlayabilirsiniz. Yazışmalarınız gizli değildir; danışman öğretmeniniz ve il koordinatörünüz okuyabilir.\n\nGençTek",
  },
  {
    kod: "YENI_YAZISMA",
    konu: "Sizinle bir yazışma açıldı",
    govdeSablonu:
      "Merhaba,\n\n{{isteyenAdSoyad}} sizinle iletişim kurmak istedi ve isteği onaylandı. Yazışma sayfanızdan görebilirsiniz.\n\nYazışmalarınız gizli değildir; danışman öğretmeniniz ve il koordinatörünüz okuyabilir.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_MENTORLUK",
    konu: "Onay bekleyen mentörlük başvurusu: {{basvuranAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{basvuranAdSoyad}} mentörlük başvurusu yaptı ve onayınızı bekliyor.\n\nBaşvurduğu alanlar: {{kapsam}}\n\nBaşvuruyu Yönetim Paneli'ndeki Mentörlük kartından inceleyip onaylayabilir ya da gerekçesiyle reddedebilirsiniz.\n\nGençTek",
  },
  {
    kod: "MENTORLUK_KARARI",
    konu: "Mentörlük başvurunuz {{sonuc}}",
    govdeSablonu:
      "Merhaba,\n\nMentörlük başvurunuz {{sonuc}}.\n\nGerekçe: {{gerekce}}\n\nOnaylandıysa menünüzde \"Mentörlüğüm\" sekmesi açıldı; panodaki ilanlara oradan cevap yazabilirsiniz.\n\nGençTek",
  },
  /*
   * MENTÖRLÜĞÜN KALDIRILMASI ONAYA TABİ (28 Ağustos 2026 · istek: "hiyerarşi
   * olsun: öğretmeninkini koordinatör ve proje yöneticisi, koordinatörünkini
   * de proje yöneticisi onaylasın, proje yöneticisine onay yok").
   *
   * Metinler migration ile birebir aynı (20260828110000_mentorluk_kaldirma_
   * talebi): kurulu veritabanı göçten, yeni kurulum seed'den alıyor ve ikisi
   * ayrışırsa aynı bildirim iki ortamda iki farklı cümle olurdu.
   */
  {
    kod: "MENTORLUK_KALDIRMA_TALEBI",
    konu: "Onayınızı bekleyen mentörlük kaldırma talebi: {{ogrenciAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{isteyenAdSoyad}} ({{isteyenGorevi}}), {{ogrenciAdSoyad}} adlı öğrencinin mentörlüğünün kaldırılmasını istedi.\n\nGerekçe: {{gerekce}}\n\nÖğrenci, siz karar verene kadar mentör olarak kalır. Talebi Öğrenciler ekranındaki Mentörlük sütunundan onaylayabilir ya da gerekçesiyle reddedebilirsiniz.\n\nGençTek",
  },
  {
    kod: "MENTORLUK_KALDIRMA_KARARI",
    konu: "Mentörlük kaldırma talebiniz {{sonuc}}: {{ogrenciAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{ogrenciAdSoyad}} adlı öğrencinin mentörlüğünün kaldırılması yönündeki talebiniz {{kararVerenAdSoyad}} tarafından {{sonuc}}.\n\nGerekçe: {{gerekce}}\n\nGençTek",
  },
  /*
   * GENÇTEK GÖREVLERİ (26 Ağustos 2026 · istek: "bunlardan birine öğrenci
   * başvurduğunda yönetici sayfasına düşmüyor").
   *
   * İki şablon 21 Ağustos'ta koda eklenmiş ama SEED'E YAZILMAMIŞTI. Şablonu
   * olmayan bildirim sessizce yutuluyor (bkz. lib/bildirim/gonder.ts: uyarı
   * yazılıp çıkılıyor), dolayısıyla:
   *   · başvuru geldiğinde proje yöneticisine hiçbir uyarı gitmiyordu,
   *   · karar verildiğinde başvurana hiçbir sonuç gitmiyordu — üstelik yönetim
   *     ekranı "başvurana bildirim gönderildi" diyordu.
   * Başvurunun kendisi kaydediliyordu ve GençTek Görevleri ekranında
   * görünüyordu; eksik olan haberdi.
   */
  {
    kod: "ONAY_BEKLEYEN_GENCTEK_GOREVI",
    konu: "Onay bekleyen GençTek görev başvurusu: {{basvuranAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{basvuranAdSoyad}}, {{gorevAdi}} görevine başvurdu ve onayınızı bekliyor.\n\nBaşvuruyu Yönetim Paneli'ndeki GençTek Görevleri kartından inceleyip onaylayabilir ya da gerekçesiyle reddedebilirsiniz.\n\nGençTek",
  },
  {
    kod: "GENCTEK_GOREV_KARARI",
    konu: "GençTek görev başvurunuz {{sonuc}}",
    govdeSablonu:
      "Merhaba,\n\n{{gorevAdi}} görevine yaptığınız başvuru {{sonuc}}.\n\nGerekçe: {{gerekce}}\n\nOnaylandıysa görev, Görevlerim ekranınızda listelenir.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_URUN",
    konu: "Onay bekleyen ürün: {{urunAdi}}",
    govdeSablonu:
      "Merhaba,\n\n{{sahipAdSoyad}}, {{urunAdi}} adlı ürününü markette paylaşmak istiyor ve onayınızı bekliyor.\n\nÜrünü Onay kuyruğu ekranından inceleyip onaylayabilir ya da gerekçesiyle reddedebilirsiniz.\n\nGençTek",
  },
  {
    kod: "URUN_MARKET_KARARI",
    konu: "{{urunAdi}} ürününüz {{sonuc}}",
    govdeSablonu:
      "Merhaba,\n\nMarkette paylaşmak istediğiniz {{urunAdi}} adlı ürününüz {{sonuc}}.\n\nGerekçe: {{gerekce}}\n\nOnaylandıysa ürününüz GençTek Market'te görünüyor.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_PANO_ILANI",
    konu: "Onay bekleyen pano ilanı: {{acanAdSoyad}}",
    govdeSablonu:
      'Merhaba,\n\n{{acanAdSoyad}} panoya bir ilan açtı ve onayınızı bekliyor.\n\nİlan türü: {{tur}}\nBaşlık: {{talepBasligi}}\n\nİlanı Yönetim Paneli\'ndeki "Pano ilanları" kartından inceleyip onaylayabilir ya da gerekçesiyle reddedebilirsiniz. Onaylanana kadar ilan panoda görünmez.\n\nGençTek',
  },
  {
    kod: "PANO_ILANI_KARARI",
    konu: "Pano ilanınız {{sonuc}}",
    govdeSablonu:
      'Merhaba,\n\n"{{talepBasligi}}" başlıklı pano ilanınız {{sonuc}}.\n\nGerekçe: {{gerekce}}\n\nOnaylandıysa ilanınız panoda yayımlandı ve diğer kullanıcılar bağlantı isteği gönderebilir. Reddedildiyse gerekçeyi dikkate alarak yeni bir ilan açabilirsiniz.\n\nGençTek',
  },
  {
    kod: "FAALIYET_ONAY_SONUCU",
    konu: "{{faaliyetAdi}} etkinliğiniz {{sonuc}}",
    govdeSablonu:
      "Merhaba,\n\nOnaya sunduğunuz {{faaliyetAdi}} adlı etkinlik {{kararVerenAdSoyad}} tarafından {{sonuc}}.\n\nEtkinliğin güncel durumunu panelinizden görebilirsiniz.\n\nGençTek",
  },
  {
    kod: "DANISMANA_KOPYA_ULUSAL_BASVURU",
    konu: "Öğrenciniz bir ulusal etkinliğe başvurdu",
    govdeSablonu:
      "Merhaba,\n\nDanışmanlığını yaptığınız {{ogrenciAdSoyad}}, {{faaliyetAdi}} adlı ulusal etkinliğe başvurdu. Bu bildirim yalnızca bilgilendirme amaçlıdır; onayınız gerekmez.\n\nGençTek",
  },
  {
    kod: "FAALIYET_IPTAL_EDILDI",
    konu: "{{faaliyetAdi}} iptal edildi",
    govdeSablonu:
      "Merhaba,\n\nBaşvurduğunuz {{faaliyetAdi}} adlı etkinlik iptal edildi; başvurunuz bu nedenle kapatıldı.\n\nGerekçe: {{gerekce}}\n\nGençTek",
  },
  {
    kod: "OGRENCI_ATANAMADI",
    konu: "Danışman atanamayan öğrenci: {{ogrenciAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{ogrenciAdSoyad}} adlı öğrenciye danışman atanamadı: okulunda danışman öğretmen yok ve {{ilKodu}} kodlu ilin koordinatörü tanımlı değil. İl koordinatörü ataması gerekiyor.\n\nGençTek",
  },
  {
    kod: "ADINA_BASVURU_YAPILDI",
    konu: "{{faaliyetAdi}} için adınıza başvuru yapıldı",
    govdeSablonu:
      "Merhaba {{ogrenciAdSoyad}},\n\n{{basvuranAdSoyad}}, {{faaliyetAdi}} adlı etkinliğe sizin adınıza başvuru yaptı. Katılmak istemiyorsanız başvurunuzu panelinizden geri çekebilirsiniz.\n\nGençTek",
  },
  {
    kod: "ADINA_BASVURU_GERI_CEKILDI",
    konu: "Adınıza yapılan başvuru geri çekildi",
    govdeSablonu:
      "Merhaba {{ogrenciAdSoyad}},\n\n{{basvuranAdSoyad}}, sizin adınıza yaptığı başvuruyu geri çekti.\n\nGençTek",
  },
  {
    kod: "KONTENJANDA_YER_ACILDI",
    konu: "{{faaliyetAdi}} etkinliğinde yer açıldı",
    govdeSablonu:
      "Merhaba,\n\n{{katilimciAdSoyad}}, {{faaliyetAdi}} etkinliğine seçilmiş başvurusunu geri çekti. Kontenjanda {{kalanYer}} yer boş; yedek listesinde {{yedekSayisi}} başvuru bekliyor.\n\nYedekten katılımcı çağırmak için etkinliğin başvuru listesini açabilirsiniz.\n\nGençTek",
  },
  {
    kod: "ADINA_BASVURU_SONUCU",
    konu: "{{ogrenciAdSoyad}} · {{faaliyetAdi}} başvuru sonucu",
    govdeSablonu:
      "Merhaba,\n\nAdına başvuru yaptığınız {{ogrenciAdSoyad}} için {{faaliyetAdi}} etkinliğinin sonucu: {{sonuc}}.\n\nGençTek",
  },
  {
    kod: "ONAY_BEKLEYEN_DIS_BASVURU",
    konu: "Onay bekleyen giriş başvurusu · {{basvuranAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{basvuranAdSoyad}} ({{tur}} · {{ilAdi}}) sisteme giriş başvurusu yaptı ve onayınızı bekliyor.\n\nBaşvuruyu Dış Başvurular ekranından değerlendirebilirsiniz.\n\nGençTek",
  },
  {
    kod: "ERISIM_ANOMALISI",
    konu: "Olağan dışı erişim örüntüsü · {{kullaniciAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{gun}} günü için olağan dışı bir erişim örüntüsü saptandı.\n\nKullanıcı: {{kullaniciAdSoyad}}\nÖrüntü: {{anomaliTuru}}\nErişim kaydı: {{logSayisi}}\nBenzersiz hedef: {{benzersizHedefSayisi}}\n\nAyrıntıları Panel → Erişim Kayıtları ekranından kullanıcı ve tarih ile süzerek inceleyin. Bu uyarı tek başına ihlal kararı değildir; inceleme gerektiren bir bulgudur.\n\nGençTek",
  },
  {
    kod: "KVKK_BASVURUSU_ALINDI",
    konu: "Yeni KVKK başvurusu: {{basvuranAdSoyad}}",
    govdeSablonu:
      "Merhaba,\n\n{{basvuranAdSoyad}}, kişisel verileriyle ilgili bir başvuru yaptı.\n\nTalep konusu: {{konular}}\n\nBaşvuru, Yönetim Paneli'ndeki KVKK Başvuruları ekranından yanıtlanır. Kanunî yanıt süresi en geç {{sonTarih}} tarihinde dolar.\n\nGençTek",
  },
  {
    kod: "KVKK_BASVURUSU_YANITLANDI",
    konu: "KVKK başvurunuz yanıtlandı",
    govdeSablonu:
      "Merhaba,\n\n{{tarih}} tarihli kişisel veri başvurunuz sonuçlandı.\n\nSonuç: {{sonuc}}\n\n{{yanit}}\n\nBaşvurunuzun tamamını ve bu yanıtı Kişisel Verilerim ekranından görebilirsiniz. Sonucu yeterli bulmazsanız Kişisel Verileri Koruma Kurulu'na şikâyette bulunma hakkınız saklıdır.\n\nGençTek",
  },
];

async function referansVerileriYukle() {
  for (const il of ILLER) {
    await prisma.il.upsert({
      where: { ilKodu: il.ilKodu },
      update: { ad: il.ad },
      create: il,
    });
  }

  for (const ilce of ORNEK_ILCELER) {
    await prisma.ilce.upsert({
      where: { ilceKodu: ilce.ilceKodu },
      update: { ad: ilce.ad, ilKodu: ilce.ilKodu },
      create: ilce,
    });
  }

  for (const kurum of ORNEK_KURUMLAR) {
    await prisma.kurum.upsert({
      where: { kurumKodu: kurum.kurumKodu },
      update: kurum,
      create: kurum,
    });
  }

  console.log(
    `  ${ILLER.length} il, ${ORNEK_ILCELER.length} ilçe, ${ORNEK_KURUMLAR.length} kurum`,
  );
}

async function calismaGruplariniYukle() {
  for (const [sira, ad] of CALISMA_GRUPLARI.entries()) {
    await prisma.calismaGrubu.upsert({
      where: { ad },
      update: { siraNo: sira + 1 },
      create: { ad, siraNo: sira + 1 },
    });
  }
  console.log(`  ${CALISMA_GRUPLARI.length} çalışma grubu`);
}

async function temelEtkinlikProgramlariniYukle() {
  for (const [sira, program] of TEMEL_ETKINLIK_PROGRAMLARI.entries()) {
    await prisma.temelEtkinlikProgrami.upsert({
      where: { ad: program.ad },
      // Pasife alınmış bir program seed ile yeniden aktifleştirilmez; grup ve
      // sıra bilgisi tazelenir, "aktif" alanına dokunulmaz.
      update: { grup: program.grup, siraNo: sira + 1 },
      create: { ad: program.ad, grup: program.grup, siraNo: sira + 1 },
    });
  }
  console.log(
    `  ${TEMEL_ETKINLIK_PROGRAMLARI.length} temel/çalışma grubu etkinlik programı`,
  );
}

async function sistemAyarlariniYukle() {
  for (const ayar of SISTEM_AYARLARI) {
    await prisma.sistemAyari.upsert({
      where: { anahtar: ayar.anahtar },
      update: { aciklama: ayar.aciklama },
      create: ayar,
    });
  }
  console.log(`  ${SISTEM_AYARLARI.length} sistem ayarı`);
}

async function bildirimSablonlariniYukle() {
  for (const sablon of BILDIRIM_SABLONLARI) {
    await prisma.bildirimSablonu.upsert({
      where: { kod: sablon.kod },
      update: { konu: sablon.konu, govdeSablonu: sablon.govdeSablonu },
      create: sablon,
    });
  }
  console.log(`  ${BILDIRIM_SABLONLARI.length} bildirim şablonu`);
}

/** Kimlik kataloğundaki bir kullanıcıyı veritabanına yazar (idempotent). */
async function kullaniciOlustur(authProviderId: string) {
  const kimlik = mockKimlikBul(authProviderId);
  if (!kimlik) {
    throw new Error(`Mock kimlik kataloğunda yok: ${authProviderId}`);
  }

  return prisma.kullanici.upsert({
    where: { authProviderId },
    update: {},
    create: {
      authProviderId: kimlik.authProviderId,
      ad: kimlik.ad,
      soyad: kimlik.soyad,
      cinsiyet: kimlik.cinsiyet,
      kurumKodu: kimlik.kurumKodu,
      ilKodu: kimlik.ilKodu,
      ilceKodu: kimlik.ilceKodu,
      sinif: kimlik.sinif,
      brans: kimlik.brans,
      egitimOgretimYili: kimlik.egitimOgretimYili,
    },
    select: { id: true },
  });
}

/** Rolü yoksa açar; varsa dokunmaz. Rol geçmişi bozulmaz. */
async function rolVer(
  kullaniciId: number,
  rolKodu: "PROJE_YONETICISI" | "IL_KOORDINATOR",
  kapsam: { ilKodu?: string; atayanKullaniciId?: number } = {},
) {
  const mevcut = await prisma.kullaniciRol.findFirst({
    where: { kullaniciId, rolKodu, bitisTarihi: null },
    select: { id: true },
  });
  if (mevcut) return;

  await prisma.kullaniciRol.create({
    data: {
      kullaniciId,
      rolKodu,
      ilKodu: kapsam.ilKodu ?? null,
      atayanKullaniciId: kapsam.atayanKullaniciId ?? null,
    },
  });
}

/**
 * Katalogdan çıkarılmış proje yöneticilerini görevden alır.
 *
 * SİLME YAPILMAZ: kullanıcı kaydı, açtığı faaliyetler ve erişim logları ona
 * bağlı olduğu için durur. Rol geçmişli tabloda kapatılır (bitiş tarihi
 * yazılır) ve kayıt pasife alınır — böylece kişi hiçbir listede çıkmaz ama
 * geçmiş bozulmaz.
 */
async function eskiProjeYoneticileriniGorevdenAl(gecerliIdler: number[]) {
  const eskiler = await prisma.kullaniciRol.findMany({
    where: {
      rolKodu: "PROJE_YONETICISI",
      bitisTarihi: null,
      kullaniciId: { notIn: gecerliIdler },
    },
    select: {
      id: true,
      kullaniciId: true,
      kullanici: { select: { ad: true, soyad: true } },
    },
  });

  for (const rol of eskiler) {
    await prisma.kullaniciRol.update({
      where: { id: rol.id },
      data: { bitisTarihi: new Date() },
    });
    await prisma.kullanici.update({
      where: { id: rol.kullaniciId },
      data: { aktif: false },
    });
    console.log(
      `  görevden alındı: ${rol.kullanici.ad} ${rol.kullanici.soyad} (kayıt pasife alındı, silinmedi)`,
    );
  }

  return eskiler.length;
}

async function baslangicYoneticileriniOlustur() {
  const yoneticiIdleri: number[] = [];
  for (const authProviderId of MOCK_PROJE_YONETICISI_KIMLIKLERI) {
    const yonetici = await kullaniciOlustur(authProviderId);
    await rolVer(yonetici.id, "PROJE_YONETICISI");
    yoneticiIdleri.push(yonetici.id);
  }

  await eskiProjeYoneticileriniGorevdenAl(yoneticiIdleri);

  /*
   * Koordinatörü kim atadı bilgisi için yöneticilerden biri yeterli; listedeki
   * ilk kişi seçiliyor. Bu yalnızca izleme amaçlı bir alan, yetki taşımaz.
   */
  const projeYoneticisi = { id: yoneticiIdleri[0] };

  for (const koordinator of MOCK_KOORDINATOR_KIMLIKLERI) {
    const kullanici = await kullaniciOlustur(koordinator.authProviderId);
    // Öğretmen kaydı olduğu için öğretmen profili de açılır; danışmanlık
    // işaretlenmez (bir öğretmen aynı anda hem danışman hem koordinatör olamaz).
    await prisma.ogretmenProfil.upsert({
      where: { kullaniciId: kullanici.id },
      update: {},
      create: { kullaniciId: kullanici.id },
    });
    await rolVer(kullanici.id, "IL_KOORDINATOR", {
      ilKodu: koordinator.ilKodu,
      atayanKullaniciId: projeYoneticisi.id,
    });
  }

  console.log(
    `  ${MOCK_PROJE_YONETICISI_KIMLIKLERI.length} proje yöneticisi, ${MOCK_KOORDINATOR_KIMLIKLERI.length} il koordinatörü`,
  );
}

async function main() {
  console.log("GençTek seed başlıyor...");
  await referansVerileriYukle();
  await calismaGruplariniYukle();
  await temelEtkinlikProgramlariniYukle();
  await sistemAyarlariniYukle();
  await bildirimSablonlariniYukle();
  /*
   * KAYIT KİPİNDE MOCK YÖNETİCİ AÇILMAZ (17 Eylül 2026). Katalogdaki
   * yöneticilerin şifresi yok, o kipte giremezler; açılmaları yalnızca
   * listelerde görünen ölü kayıtlar bırakırdı. İlk yönetici
   * `npm run kullanici:yonetici` ile açılır.
   */
  if ((process.env.AUTH_PROVIDER ?? "mock") === "mock") {
    await baslangicYoneticileriniOlustur();
  } else {
    console.log(
      "  başlangıç yöneticileri atlandı (AUTH_PROVIDER mock değil) · npm run kullanici:yonetici",
    );
  }
  console.log("Seed tamamlandı.");
}

main()
  .catch((hata) => {
    console.error("Seed başarısız:", hata);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

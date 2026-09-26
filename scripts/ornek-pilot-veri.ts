import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { AuthKimlik } from "@/lib/auth/tipler";
import {
  danismanAdaylariGetir,
  ilkAtamayiYurut,
  ogrenciDanismanSecti,
} from "@/lib/danisman/atama";
import { prisma } from "@/lib/db";
import { sifreOzetle } from "@/lib/dis-kimlik/sifre";
import type {
  BasvuruDurumu,
  EtkinlikKategorisi,
  Kapsam,
  KatilimBicimi,
  KazanimTipi,
  OnayDurumu,
} from "@/generated/prisma/client";
import { tcKimlikNoGecerliMi } from "@/lib/kayit/kurallar";
import { kullaniciSagla } from "@/lib/kullanici/sagla";
import { egitimOgretimYili } from "@/lib/ogretmen/gorev-yillari";

/**
 * Pilot tanıtım verisi — Ankara ve İstanbul'da kayıtla giriş yapılabilen
 * altı kişi (her ilde bir koordinatör, bir öğretmen, bir öğrenci) ve onların
 * ürettiği etkinlik, başvuru, yorum, kazanım, hedef ve gönderiler.
 *
 * ornek-veri.ts'ten farkı: o betik yüzlerce ŞİFRESİZ (mock) kişi üretir; bu
 * betiğin kişileri AUTH_PROVIDER="kayit" ile T.C. + şifreyle girer ve ekranlar
 * dolu görünsün diye içerik girer.
 *
 * Kullanım:
 *   npm run veri:pilot                      üretir, giriş bilgilerini yazar
 *   npm run veri:pilot -- --temizle         bu betiğin ürettiği her şeyi siler
 *   npm run veri:pilot -- --kurum-06=750003 --kurum-34=750001
 *                                           okulları elle seçer (varsayılan:
 *                                           o ilin kurum kodu en küçük aktif okulu)
 *
 * ŞİFRELER DEPODA DURMAZ: her çalıştırmada rastgele üretilir ve yalnızca
 * ekrana yazılır. Kişiler zaten varsa betik hiçbir şey yazmadan durur —
 * yeniden üretmek için önce --temizle.
 *
 * T.C. numaraları uydurmadır ama sağlama basamakları geçerlidir (kayıt
 * formu geçersiz numarayı reddediyor). "99999" ile başlarlar; bu aralık
 * gerçek bir kişiye çıkma ihtimali en düşük olanıdır, sıfır değildir.
 */

// ---------------------------------------------------------------------------
// Kimlikler
// ---------------------------------------------------------------------------

function tcUret(ilkDokuz: string): string {
  const h = [...ilkDokuz].map(Number);
  const tekler = h[0] + h[2] + h[4] + h[6] + h[8];
  const ciftler = h[1] + h[3] + h[5] + h[7];
  const onuncu = (((tekler * 7 - ciftler) % 10) + 10) % 10;
  const onbirinci = (h.reduce((a, b) => a + b, 0) + onuncu) % 10;
  const tc = `${ilkDokuz}${onuncu}${onbirinci}`;
  if (!tcKimlikNoGecerliMi(tc)) throw new Error(`Geçersiz T.C. üretildi: ${tc}`);
  return tc;
}

type Rol = "KOORDINATOR" | "OGRETMEN" | "OGRENCI";

interface KisiTanimi {
  anahtar: string;
  rol: Rol;
  ilKodu: "06" | "34";
  tc: string;
  ad: string;
  soyad: string;
  cinsiyet: "E" | "K";
  sinif?: string;
  brans?: string;
  hakkinda: string;
}

const KISILER: KisiTanimi[] = [
  {
    anahtar: "ank-koord",
    rol: "KOORDINATOR",
    ilKodu: "06",
    tc: tcUret("999990601"),
    ad: "Zeynep",
    soyad: "Arslan",
    cinsiyet: "K",
    brans: "Bilişim Teknolojileri",
    hakkinda:
      "Ankara GençTek il koordinatörüyüm. 12 yıldır bilişim öğretmenliği yapıyorum; okullar arası takım çalışmasını ve öğrenci girişimlerini büyütmeyi önemsiyorum.",
  },
  {
    anahtar: "ank-ogretmen",
    rol: "OGRETMEN",
    ilKodu: "06",
    tc: tcUret("999990602"),
    ad: "Selin",
    soyad: "Korkmaz",
    cinsiyet: "K",
    brans: "Bilişim Teknolojileri",
    hakkinda:
      "BİLSEM'de bilişim öğretmeniyim. Robotik ve gömülü sistemler atölyeleri yürütüyorum, öğrencilerimle TEKNOFEST'e hazırlanıyoruz.",
  },
  {
    anahtar: "ank-ogrenci",
    rol: "OGRENCI",
    ilKodu: "06",
    tc: tcUret("999990603"),
    ad: "Elif",
    soyad: "Yıldız",
    cinsiyet: "K",
    sinif: "10-A",
    hakkinda:
      "Yapay zekâ ve robotikle ilgileniyorum. Okulumuzun robotik takımındayım; boş zamanlarımda Python ile küçük projeler geliştiriyorum.",
  },
  {
    anahtar: "ist-koord",
    rol: "KOORDINATOR",
    ilKodu: "34",
    tc: tcUret("999993401"),
    ad: "Murat",
    soyad: "Aydın",
    cinsiyet: "E",
    brans: "Matematik",
    hakkinda:
      "İstanbul GençTek il koordinatörüyüm. Matematik öğretmeniyim; bilgisayar olimpiyatları ve siber güvenlik çalışma gruplarını il genelinde koordine ediyorum.",
  },
  {
    anahtar: "ist-ogretmen",
    rol: "OGRETMEN",
    ilKodu: "34",
    tc: tcUret("999993402"),
    ad: "Kerem",
    soyad: "Şahin",
    cinsiyet: "E",
    brans: "Bilişim Teknolojileri",
    hakkinda:
      "Anadolu lisesinde bilişim öğretmeniyim. Web ve mobil programlama kulübünü yürütüyorum; öğrencilerimin ürünlerini gerçek kullanıcıya ulaştırmayı hedefliyorum.",
  },
  {
    anahtar: "ist-ogrenci",
    rol: "OGRENCI",
    ilKodu: "34",
    tc: tcUret("999993403"),
    ad: "Arda",
    soyad: "Çelik",
    cinsiyet: "E",
    sinif: "11-B",
    hakkinda:
      "Siber güvenlik ve web programlamaya meraklıyım. CTF yarışmalarına katılıyorum, okulumun kulübünde akranlarıma Linux temelleri anlatıyorum.",
  },
];

const IL_ADLARI = { "06": "Ankara", "34": "İstanbul" } as const;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/** Okunabilir ama tahmin edilemez şifre: Gt-xxxx-xxxx-xx (karışık karakter). */
function sifreUret(): string {
  const alfabe = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bayt = randomBytes(10);
  const k = [...bayt].map((b) => alfabe[b % alfabe.length]).join("");
  return `Gt-${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8)}`;
}

/** 2026-09-26 gibi bir günü İstanbul saatiyle belirli bir saate çevirir. */
function gun(tarih: string, saat = "10:00"): Date {
  return new Date(`${tarih}T${saat}:00+03:00`);
}

function gunEkle(tarih: Date, gunSayisi: number): Date {
  return new Date(tarih.getTime() + gunSayisi * 86_400_000);
}

function argDeger(ad: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${ad}=`))?.split("=")[1];
}

// ---------------------------------------------------------------------------
// Temizlik
// ---------------------------------------------------------------------------

async function uretilenleriSil() {
  const kullanicilar = await prisma.kullanici.findMany({
    where: { authProviderId: { in: KISILER.map((k) => k.tc) } },
    select: { id: true },
  });
  const idler = kullanicilar.map((k) => k.id);
  if (idler.length === 0) {
    console.log("Silinecek pilot kullanıcı yok.");
    return;
  }
  const kimde = { in: idler };

  await prisma.gonderiYorumu.deleteMany({
    where: { OR: [{ yazanKullaniciId: kimde }, { gonderi: { yazanKullaniciId: kimde } }] },
  });
  await prisma.gonderi.deleteMany({ where: { yazanKullaniciId: kimde } });

  // Başkasının etkinliğindeki izleri; kendi etkinlikleri aşağıda zincirleme gider.
  await prisma.faaliyetBelgesi.deleteMany({
    where: { OR: [{ katilimciId: kimde }, { uretenKullaniciId: kimde }] },
  });
  await prisma.basvuru.deleteMany({
    where: {
      OR: [
        { katilimciId: kimde },
        { degerlendirenKullaniciId: kimde },
        { yoklamaAlanKullaniciId: kimde },
        { adinaBasvuranKullaniciId: kimde },
      ],
    },
  });
  await prisma.yorum.updateMany({
    where: { ustYorum: { yazanKullaniciId: kimde } },
    data: { ustYorumId: null },
  });
  await prisma.yorum.deleteMany({ where: { yazanKullaniciId: kimde } });
  await prisma.faaliyetRaporu.deleteMany({ where: { yazanKullaniciId: kimde } });
  await prisma.faaliyet.updateMany({
    where: { duzenleyenKullaniciId: kimde },
    data: { kapakEkId: null },
  });
  await prisma.faaliyetEk.deleteMany({ where: { yukleyenKullaniciId: kimde } });
  // Pilot koordinatörün onayladığı başkasının etkinliği silinmez, onay izi kalkar.
  await prisma.faaliyet.updateMany({
    where: { onaylayanKullaniciId: kimde, duzenleyenKullaniciId: { notIn: idler } },
    data: { onaylayanKullaniciId: null },
  });
  await prisma.faaliyet.deleteMany({ where: { duzenleyenKullaniciId: kimde } });

  await prisma.kullaniciKazanim.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.kullaniciHedefi.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.ogrenciCalismaGrubu.deleteMany({ where: { ogrenciId: kimde } });
  await prisma.danismanAtama.deleteMany({
    where: { OR: [{ ogrenciId: kimde }, { danismanKullaniciId: kimde }] },
  });
  await prisma.kullaniciOnayi.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.bildirim.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.erisimlogu.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.kayitKimlik.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.kullaniciRol.deleteMany({
    where: { OR: [{ kullaniciId: kimde }, { atayanKullaniciId: kimde }] },
  });
  await prisma.ogrenciProfil.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.ogretmenProfil.deleteMany({ where: { kullaniciId: kimde } });
  await prisma.kullanici.deleteMany({ where: { id: kimde } });

  console.log(`${idler.length} pilot kullanıcı ve ürettikleri silindi.`);
}

// ---------------------------------------------------------------------------
// Kişiler
// ---------------------------------------------------------------------------

interface Kisi extends KisiTanimi {
  id: number;
  sifre: string;
  kurumKodu: number | null;
  kurumAdi: string | null;
}

async function okulSec(ilKodu: "06" | "34") {
  const elle = argDeger(`kurum-${ilKodu}`);
  const okul = await prisma.kurum.findFirst({
    where: elle
      ? { kurumKodu: Number(elle), ilKodu, aktif: true }
      : { ilKodu, aktif: true },
    orderBy: { kurumKodu: "asc" },
    select: { kurumKodu: true, ad: true, ilceKodu: true },
  });
  if (!okul) {
    throw new Error(
      `${IL_ADLARI[ilKodu]} için aktif okul bulunamadı${elle ? ` (kurum ${elle})` : ""}.`,
    );
  }
  return okul;
}

async function kisileriOlustur(): Promise<Record<string, Kisi>> {
  const projeYoneticisi = await prisma.kullaniciRol.findFirst({
    where: { rolKodu: "PROJE_YONETICISI", bitisTarihi: null },
    select: { kullaniciId: true },
  });
  const okullar = { "06": await okulSec("06"), "34": await okulSec("34") };
  const yil = egitimOgretimYili(new Date());
  const sonuc: Record<string, Kisi> = {};

  for (const tanim of KISILER) {
    const okul = tanim.rol === "KOORDINATOR" ? null : okullar[tanim.ilKodu];
    const kimlik: AuthKimlik = {
      authProviderId: tanim.tc,
      tip: tanim.rol === "OGRENCI" ? "OGRENCI" : "OGRETMEN",
      ad: tanim.ad,
      soyad: tanim.soyad,
      cinsiyet: tanim.cinsiyet,
      // Koordinatörün okulu yoktur, kapsamı ildir (bkz. ornek-veri.ts).
      kurumKodu: okul?.kurumKodu ?? null,
      ilKodu: tanim.ilKodu,
      ilceKodu: okul?.ilceKodu ?? null,
      sinif: tanim.sinif ?? null,
      brans: tanim.brans ?? null,
      egitimOgretimYili: yil,
    };
    const { kullaniciId } = await kullaniciSagla(kimlik);
    const sifre = sifreUret();
    await prisma.kayitKimlik.create({
      data: { kullaniciId, sifreOzeti: await sifreOzetle(sifre) },
    });
    await prisma.kullanici.update({
      where: { id: kullaniciId },
      data: { hakkinda: tanim.hakkinda },
    });

    if (tanim.rol === "KOORDINATOR") {
      await prisma.kullaniciRol.create({
        data: {
          kullaniciId,
          rolKodu: "IL_KOORDINATOR",
          ilKodu: tanim.ilKodu,
          atayanKullaniciId: projeYoneticisi?.kullaniciId ?? null,
          aciklama: "Pilot tanıtım hesabı.",
        },
      });
    }

    sonuc[tanim.anahtar] = {
      ...tanim,
      id: kullaniciId,
      sifre,
      kurumKodu: okul?.kurumKodu ?? null,
      kurumAdi: okul?.ad ?? null,
    };
  }

  // Öğrenciler, okullarındaki pilot öğretmene bağlanır.
  for (const [ogrenci, ogretmen] of [
    ["ank-ogrenci", "ank-ogretmen"],
    ["ist-ogrenci", "ist-ogretmen"],
  ] as const) {
    const o = sonuc[ogrenci];
    const karar = await ilkAtamayiYurut(o.id);
    if (karar.tur === "SECIM_GEREKLI") {
      const adaylar = await danismanAdaylariGetir(o.kurumKodu as number);
      if (adaylar.some((a) => a.kullaniciId === sonuc[ogretmen].id)) {
        await ogrenciDanismanSecti(o.id, sonuc[ogretmen].id);
      }
    }
  }

  return sonuc;
}

// ---------------------------------------------------------------------------
// Etkinlikler
// ---------------------------------------------------------------------------

interface EtkinlikTanimi {
  kod: string;
  duzenleyen: string;
  ad: string;
  aciklama: string;
  kapsam: Kapsam;
  kategori: EtkinlikKategorisi;
  program?: string;
  gruplar?: string[];
  tarih: Date;
  gunSuresi?: number;
  bicim: KatilimBicimi;
  hedefKitle: string;
  kontenjan: number;
  /** Başvuru penceresi etkinlikten kaç gün önce açılıp kaç gün önce kapanır. */
  pencere?: [number, number];
  onay?: OnayDurumu;
  onaylayan?: string;
  iptal?: string;
  rapor?: { degerlendirme: string; kazanimlar: string };
}

const E: EtkinlikTanimi[] = [
  // --- Ankara · il koordinatörü ------------------------------------------
  {
    kod: "ank-hack",
    duzenleyen: "ank-koord",
    ad: "Hack The Idea Ankara: Akıllı Şehir",
    aciklama:
      "Ankara'daki lise öğrencileri, şehrin ulaşım, enerji ve atık sorunlarına 24 saatte fikir ve prototip geliştirdi. Takımlar jüri önünde 5 dakikalık sunum yaptı; ilk üç takım GençTek Zirvesi'ne davet edildi.",
    kapsam: "IL",
    kategori: "TEMEL_ETKINLIK",
    program: "Hack The Idea",
    gruplar: ["Yapay Zekâ", "Web Programlama"],
    tarih: gun("2026-05-16", "09:00"),
    gunSuresi: 1,
    bicim: "YUZ_YUZE",
    hedefKitle: "9-12. sınıf öğrencileri",
    kontenjan: 60,
    rapor: {
      degerlendirme:
        "14 takımdan 52 öğrenci katıldı. Mentör desteği ikinci gün öğleden sonra yoğunlaştı; bir sonraki sefer mentör vardiyaları erkene alınmalı.",
      kazanimlar:
        "Takım çalışması, hızlı prototipleme, sunum becerisi. 3 takım fikrini okul kulübünde geliştirmeye devam ediyor.",
    },
  },
  {
    kod: "ank-forum",
    duzenleyen: "ank-koord",
    ad: "Ankara Öğrenci Forumu 2026",
    aciklama:
      "Öğrencilerin GençTek çalışma gruplarındaki deneyimlerini paylaştığı, gelecek yılın il etkinlik takvimine öneri getirdiği forum.",
    kapsam: "IL",
    kategori: "TEMEL_ETKINLIK",
    program: "Öğrenci Forumu",
    tarih: gun("2026-06-06", "13:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "GençTek öğrencileri ve danışman öğretmenler",
    kontenjan: 120,
    rapor: {
      degerlendirme:
        "Forumda 11 okuldan öğrenci sunum yaptı. Öne çıkan öneri: dönem başında çalışma grupları tanıtım günü.",
      kazanimlar: "Öğrenci sesi il takvimine yansıdı; 4 öneri 2026-2027 planına alındı.",
    },
  },
  {
    kod: "ank-yz",
    duzenleyen: "ank-koord",
    ad: "Başkentte Yapay Zekâ Günleri",
    aciklama:
      "Üç günlük atölye dizisi: makine öğrenmesine giriş, görüntü sınıflandırma ve yapay zekâ etiği. Her gün sonunda öğrenciler küçük bir model eğitip sonucunu paylaştı.",
    kapsam: "IL",
    kategori: "IL_ETKINLIGI",
    gruplar: ["Yapay Zekâ"],
    tarih: gun("2026-09-08", "10:00"),
    gunSuresi: 2,
    bicim: "KARMA",
    hedefKitle: "10-12. sınıf öğrencileri",
    kontenjan: 40,
    rapor: {
      degerlendirme:
        "Çevrim içi katılım ilk gün yüksek, üçüncü gün düşük oldu. Yüz yüze grup projeleri tamamladı.",
      kazanimlar: "Temel ML kavramları, veri etiketleme, etik tartışma.",
    },
  },
  {
    kod: "ank-maraton",
    duzenleyen: "ank-koord",
    ad: "Tek Maraton Ankara",
    aciklama:
      "8 saatlik algoritma ve problem çözme maratonu. Bireysel katılım; sorular kolaydan zora sıralı. Dizüstü bilgisayar getirmeniz gerekiyor.",
    kapsam: "IL",
    kategori: "TEMEL_ETKINLIK",
    program: "Tek Maraton",
    gruplar: ["Bilgisayar Olimpiyatları"],
    tarih: gun("2026-10-24", "09:30"),
    bicim: "YUZ_YUZE",
    hedefKitle: "9-12. sınıf öğrencileri",
    kontenjan: 80,
    pencere: [30, 5],
  },
  {
    kod: "ank-robotik",
    duzenleyen: "ank-koord",
    ad: "Ankara Robotik Şenliği",
    aciklama:
      "Okul robotik takımlarının çizgi izleyen, sumo ve serbest görev kategorilerinde yarıştığı şenlik. Ziyaretçi öğrenciler için deneme atölyeleri de olacak.",
    kapsam: "IL",
    kategori: "IL_ETKINLIGI",
    gruplar: ["Robotik"],
    tarih: gun("2026-11-21", "10:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "Ortaokul ve lise robotik takımları",
    kontenjan: 150,
    pencere: [45, 10],
  },
  {
    kod: "ank-gezi",
    duzenleyen: "ank-koord",
    ad: "Teknik Gezi: Savunma Sanayii Ar-Ge Merkezi",
    aciklama:
      "Havacılık Sistemleri ve Robotik gruplarından öğrencilerle bir Ar-Ge merkezine teknik gezi. Mühendislerle soru-cevap oturumu yapılacak.",
    kapsam: "IL",
    kategori: "CALISMA_GRUBU_ETKINLIGI",
    program: "Teknik Gezi",
    gruplar: ["Havacılık Sistemleri", "Robotik"],
    tarih: gun("2026-12-10", "08:30"),
    bicim: "YUZ_YUZE",
    hedefKitle: "11-12. sınıf öğrencileri",
    kontenjan: 30,
    // Başvuru henüz açılmadı.
    pencere: [40, 14],
  },
  {
    kod: "ank-zirve",
    duzenleyen: "ank-koord",
    ad: "GençTek Zirvesi: Ankara Oturumları",
    aciklama:
      "Zirvenin Ankara ayağında il birincisi takımların proje sergisi ve sektör temsilcileriyle paneller. Tüm illerden katılıma açık.",
    kapsam: "ULUSAL",
    kategori: "TEMEL_ETKINLIK",
    program: "GençTek Zirvesi",
    tarih: gun("2027-01-15", "10:00"),
    gunSuresi: 1,
    bicim: "KARMA",
    hedefKitle: "Tüm GençTek öğrencileri",
    kontenjan: 400,
    pencere: [50, 15],
    // Koordinatörün ulusal etkinliği merkez onayına gider.
    onay: "BEKLIYOR",
  },
  {
    kod: "ank-stem",
    duzenleyen: "ank-koord",
    ad: "Dijital Yürüyüş STEM: Gençlik Parkı",
    aciklama: "Açık havada STEM istasyonları ve dijital hazine avı.",
    kapsam: "IL",
    kategori: "TEMEL_ETKINLIK",
    program: "Dijital Yürüyüş STEM",
    tarih: gun("2026-10-10", "11:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "9-10. sınıf öğrencileri",
    kontenjan: 100,
    pencere: [25, 3],
    iptal: "Etkinlik alanının o tarihte başka bir organizasyona tahsis edilmesi nedeniyle iptal edildi; bahar döneminde yeniden planlanacak.",
  },

  // --- Ankara · danışman öğretmen ----------------------------------------
  {
    kod: "ank-sera",
    duzenleyen: "ank-ogretmen",
    ad: "Arduino ile Akıllı Sera Atölyesi",
    aciklama:
      "Nem ve sıcaklık sensörleriyle otomatik sulama yapan bir mini sera kurduk. Her öğrenci kendi devresini kurup kodunu yazdı.",
    kapsam: "OKUL",
    kategori: "CALISMA_GRUBU_ETKINLIGI",
    program: "Master Tek",
    gruplar: ["Robotik"],
    tarih: gun("2026-04-18", "13:30"),
    bicim: "YUZ_YUZE",
    hedefKitle: "Okulumuzun robotik grubu",
    kontenjan: 16,
    rapor: {
      degerlendirme: "16 öğrencinin 15'i devresini çalıştırdı. Sensör kalibrasyonu beklenenden uzun sürdü.",
      kazanimlar: "Sensör okuma, röle kontrolü, basit veri kaydı.",
    },
  },
  {
    kod: "ank-python",
    duzenleyen: "ank-ogretmen",
    ad: "Scratch'ten Python'a Geçiş Kampı",
    aciklama:
      "Blok tabanlı kodlamadan metin tabanlı kodlamaya geçiş için dört oturumluk kamp. Döngüler, koşullar ve fonksiyonlar oyun örnekleriyle işlendi.",
    kapsam: "OKUL",
    kategori: "IL_ETKINLIGI",
    gruplar: ["Oyun Tasarımı"],
    tarih: gun("2026-07-01", "10:00"),
    gunSuresi: 3,
    bicim: "YUZ_YUZE",
    hedefKitle: "9. sınıf öğrencileri",
    kontenjan: 20,
  },
  {
    kod: "ank-siber",
    duzenleyen: "ank-ogretmen",
    ad: "Siber Güvenlik Farkındalık Semineri",
    aciklama:
      "Güçlü parola, oltalama e-postalarını tanıma ve sosyal medyada kişisel veri paylaşımı üzerine uygulamalı seminer.",
    kapsam: "OKUL",
    kategori: "IL_ETKINLIGI",
    gruplar: ["Siber Güvenlik", "Güvenli İnternet"],
    tarih: gun("2026-10-07", "14:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "Tüm okul öğrencileri",
    kontenjan: 60,
    pencere: [20, 1],
  },
  {
    kod: "ank-akran",
    duzenleyen: "ank-ogretmen",
    ad: "Akran Öğretimi: HTML ve CSS ile İlk Web Sayfam",
    aciklama:
      "Web grubundaki öğrencilerimiz 9. sınıflara iki oturumda kendi tanıtım sayfalarını yaptırıyor.",
    kapsam: "OKUL",
    kategori: "TEMEL_ETKINLIK",
    program: "Akran Öğretimi",
    gruplar: ["Web Programlama"],
    tarih: gun("2026-10-15", "15:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "9. sınıf öğrencileri",
    kontenjan: 24,
    pencere: [15, 2],
  },
  {
    kod: "ank-mobil",
    duzenleyen: "ank-ogretmen",
    ad: "Ankara Okullar Arası Mobil Uygulama Hackathonu",
    aciklama:
      "Okul takımları 'okulumu kolaylaştıran uygulama' temasında 2 günde mobil uygulama geliştirecek. Her takımda en fazla 4 öğrenci.",
    kapsam: "IL",
    kategori: "CALISMA_GRUBU_ETKINLIGI",
    program: "Mobil Uygulama Geliştirme Yarışması",
    gruplar: ["Mobil Programlama"],
    tarih: gun("2026-11-07", "09:00"),
    gunSuresi: 1,
    bicim: "YUZ_YUZE",
    hedefKitle: "10-12. sınıf öğrencileri",
    kontenjan: 48,
    pencere: [35, 7],
    onay: "ONAYLANDI",
    onaylayan: "ank-koord",
  },
  {
    kod: "ank-jam",
    duzenleyen: "ank-ogretmen",
    ad: "EğitiJAM Ankara Ön Elemesi",
    aciklama:
      "Eğitsel oyun geliştirme maratonunun il ön elemesi. Tema etkinlik başında açıklanacak.",
    kapsam: "IL",
    kategori: "CALISMA_GRUBU_ETKINLIGI",
    program: "EğitiJAM",
    gruplar: ["Oyun Tasarımı"],
    tarih: gun("2026-12-19", "10:00"),
    gunSuresi: 1,
    bicim: "YUZ_YUZE",
    hedefKitle: "9-12. sınıf öğrencileri",
    kontenjan: 40,
    pencere: [40, 10],
    // Öğretmenin il kapsamlı etkinliği koordinatör onayı bekliyor.
    onay: "BEKLIYOR",
  },

  // --- İstanbul · il koordinatörü ----------------------------------------
  {
    kod: "ist-ctf",
    duzenleyen: "ist-koord",
    ad: "İstanbul Liseler Arası CTF",
    aciklama:
      "Web, kriptografi, adli bilişim ve tersine mühendislik kategorilerinde bayrak yakalama yarışması. Takımlar 3 kişilik.",
    kapsam: "IL",
    kategori: "CALISMA_GRUBU_ETKINLIGI",
    program: "Capture The Flag (Bayrağı Yakala)",
    gruplar: ["Siber Güvenlik"],
    tarih: gun("2026-05-09", "10:00"),
    bicim: "KARMA",
    hedefKitle: "10-12. sınıf öğrencileri",
    kontenjan: 90,
    rapor: {
      degerlendirme:
        "27 takım katıldı, 19 takım en az bir bayrak aldı. Altyapı yükü sorunsuz geçti.",
      kazanimlar: "Temel web açıkları, şifre çözme, takım içi görev dağılımı.",
    },
  },
  {
    kod: "ist-sahne",
    duzenleyen: "ist-koord",
    ad: "Sahne Senin: Proje Sunum Günü",
    aciklama:
      "Öğrenciler yıl boyunca geliştirdikleri projeleri 7 dakikada anlattı; her sunumdan sonra jüri ve izleyici geri bildirim verdi.",
    kapsam: "IL",
    kategori: "TEMEL_ETKINLIK",
    program: "Sahne Senin",
    tarih: gun("2026-06-13", "11:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "GençTek öğrencileri",
    kontenjan: 200,
    rapor: {
      degerlendirme: "34 proje sunuldu. Salon kapasitesi doldu; gelecek yıl iki oturuma bölünmeli.",
      kazanimlar: "Topluluk önünde konuşma, geri bildirim alma.",
    },
  },
  {
    kod: "ist-g2s",
    duzenleyen: "ist-koord",
    ad: "G2S Genç Sektör Buluşması: Yazılım Kariyerleri",
    aciklama:
      "Yazılım sektöründen mühendislerle kariyer söyleşisi ve birebir mentörlük masaları.",
    kapsam: "IL",
    kategori: "TEMEL_ETKINLIK",
    program: "G2S Genç Sektör Buluşmaları",
    tarih: gun("2026-09-19", "14:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "11-12. sınıf öğrencileri",
    kontenjan: 70,
    rapor: {
      degerlendirme: "Mentörlük masaları en çok ilgi gören bölüm oldu.",
      kazanimlar: "Meslek tanıma, üniversite bölüm seçimi farkındalığı.",
    },
  },
  {
    kod: "ist-olimpiyat",
    duzenleyen: "ist-koord",
    ad: "Bilgisayar Olimpiyatlarına Hazırlık Kampı",
    aciklama:
      "Ulusal Bilgisayar Olimpiyatı'na hazırlanan öğrenciler için haftasonu kampı: dinamik programlama, graf algoritmaları, deneme sınavı.",
    kapsam: "IL",
    kategori: "IL_ETKINLIGI",
    gruplar: ["Bilgisayar Olimpiyatları"],
    tarih: gun("2026-10-17", "09:00"),
    gunSuresi: 1,
    bicim: "YUZ_YUZE",
    hedefKitle: "Olimpiyat hazırlığı yapan öğrenciler",
    kontenjan: 35,
    pencere: [25, 4],
  },
  {
    kod: "ist-espor",
    duzenleyen: "ist-koord",
    ad: "Oyunun e Hâli: İstanbul Espor Turnuvası",
    aciklama:
      "Okul takımlarının katıldığı espor turnuvası; aynı gün oyun geliştirme ve espor kariyerleri söyleşisi.",
    kapsam: "IL",
    kategori: "TEMEL_ETKINLIK",
    program: "Oyunun e Hâli",
    gruplar: ["Espor", "Oyun Tasarımı"],
    tarih: gun("2026-11-14", "10:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "9-12. sınıf öğrencileri",
    kontenjan: 128,
    pencere: [40, 7],
  },
  {
    kod: "ist-sinir",
    duzenleyen: "ist-koord",
    ad: "Sınır Ötesi: Avrupa Okullarıyla Ortak Kodlama Haftası",
    aciklama:
      "Avrupa'daki ortak okullarla çevrim içi ortak proje haftası. Karma takımlar İngilizce çalışacak.",
    // ULUSLARARASI olmalı; ck_faaliyet_kapsam kısıtı bu değeri henüz tanımıyor.
    kapsam: "ULUSAL",
    kategori: "TEMEL_ETKINLIK",
    program: "Sınır Ötesi (Beyond The Borders)",
    tarih: gun("2027-02-08", "15:00"),
    gunSuresi: 4,
    bicim: "ONLINE",
    hedefKitle: "İngilizce iletişim kurabilen lise öğrencileri",
    kontenjan: 50,
    pencere: [60, 20],
    onay: "BEKLIYOR",
  },

  // --- İstanbul · danışman öğretmen --------------------------------------
  {
    kod: "ist-web",
    duzenleyen: "ist-ogretmen",
    ad: "Kulüp Web Sitesi Sprinti",
    aciklama:
      "Web kulübü okulumuzun kulüpler sayfasını baştan yaptı. Tasarım, içerik ve kod ekipleri iki hafta boyunca çalıştı.",
    kapsam: "OKUL",
    kategori: "IL_ETKINLIGI",
    gruplar: ["Web Programlama"],
    tarih: gun("2026-03-21", "13:00"),
    gunSuresi: 13,
    bicim: "KARMA",
    hedefKitle: "Web programlama kulübü",
    kontenjan: 18,
    rapor: {
      degerlendirme: "Site yayına alındı; kulüp başvuruları sitedeki formdan toplanmaya başlandı.",
      kazanimlar: "Git ile ekip çalışması, erişilebilir tasarım.",
    },
  },
  {
    kod: "ist-linux",
    duzenleyen: "ist-ogretmen",
    ad: "Linux Komut Satırı Atölyesi",
    aciklama: "Dosya sistemi, izinler ve kabuk betikleriyle ilk adımlar. Öğrenciler kendi sanal makinelerini kurdu.",
    kapsam: "OKUL",
    kategori: "CALISMA_GRUBU_ETKINLIGI",
    program: "Master Tek",
    gruplar: ["Açık Kaynak", "Siber Güvenlik"],
    tarih: gun("2026-05-27", "14:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "10-11. sınıf öğrencileri",
    kontenjan: 20,
  },
  {
    kod: "ist-misafir",
    duzenleyen: "ist-ogretmen",
    ad: "Misafir Öğrenci Günü: Üniversite Laboratuvarı",
    aciklama:
      "Bir üniversitenin bilgisayar mühendisliği laboratuvarında bir gün geçirip araştırma görevlileriyle mini proje yapacağız.",
    kapsam: "OKUL",
    kategori: "TEMEL_ETKINLIK",
    program: "Misafir Öğretmenlik/Öğrencilik",
    tarih: gun("2026-10-22", "09:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "12. sınıf öğrencileri",
    kontenjan: 15,
    pencere: [20, 5],
  },
  {
    kod: "ist-eticaret",
    duzenleyen: "ist-ogretmen",
    ad: "E-Ticaret Ideathonu: Yerel Üreticiye Dijital Vitrin",
    aciklama:
      "Mahalledeki küçük üreticiler için e-ticaret çözümü fikri geliştirme yarışması. Kazanan fikir kulüpte hayata geçirilecek.",
    kapsam: "IL",
    kategori: "CALISMA_GRUBU_ETKINLIGI",
    program: "E-Ticaret Ideathonu",
    gruplar: ["E-Ticaret ve E-İhracat"],
    tarih: gun("2026-11-28", "10:00"),
    bicim: "YUZ_YUZE",
    hedefKitle: "9-12. sınıf öğrencileri",
    kontenjan: 60,
    pencere: [35, 7],
    onay: "ONAYLANDI",
    onaylayan: "ist-koord",
  },
  {
    kod: "ist-yz",
    duzenleyen: "ist-ogretmen",
    ad: "Yapay Zekâ ile İçerik Üretimi ve Etik",
    aciklama:
      "Üretken yapay zekâ araçlarıyla görsel ve metin üretimi, telif ve etik tartışması. Anadolu yakası okullarına açık.",
    kapsam: "IL",
    kategori: "IL_ETKINLIGI",
    gruplar: ["Yapay Zekâ", "Dijital Sanatlar ve İçerik Geliştirme"],
    tarih: gun("2026-12-05", "13:00"),
    bicim: "ONLINE",
    hedefKitle: "10-12. sınıf öğrencileri",
    kontenjan: 100,
    pencere: [30, 5],
    onay: "BEKLIYOR",
  },
];

// ---------------------------------------------------------------------------
// Başvurular: [etkinlik, kişi, durum, katıldı mı]
// ---------------------------------------------------------------------------

type BasvuruTanimi = [string, string, BasvuruDurumu, boolean?];

const BASVURULAR: BasvuruTanimi[] = [
  // Ankara öğrencisi
  ["ank-hack", "ank-ogrenci", "SECILDI", true],
  ["ank-forum", "ank-ogrenci", "SECILDI", true],
  ["ank-yz", "ank-ogrenci", "SECILDI", true],
  ["ank-sera", "ank-ogrenci", "SECILDI", true],
  ["ank-python", "ank-ogrenci", "SECILDI", false],
  ["ank-maraton", "ank-ogrenci", "BEKLIYOR"],
  ["ank-robotik", "ank-ogrenci", "SECILDI"],
  ["ank-siber", "ank-ogrenci", "SECILDI"],
  ["ank-akran", "ank-ogrenci", "GERI_CEKILDI"],
  ["ank-mobil", "ank-ogrenci", "BEKLIYOR"],
  ["ank-stem", "ank-ogrenci", "IPTAL_EDILDI"],
  // Ankara öğretmeni (katılımcı olarak)
  ["ank-hack", "ank-ogretmen", "SECILDI", true],
  ["ank-forum", "ank-ogretmen", "SECILDI", true],
  ["ank-robotik", "ank-ogretmen", "SECILDI"],
  // İstanbul öğrencisi
  ["ist-ctf", "ist-ogrenci", "SECILDI", true],
  ["ist-sahne", "ist-ogrenci", "SECILDI", true],
  ["ist-g2s", "ist-ogrenci", "YEDEK", false],
  ["ist-web", "ist-ogrenci", "SECILDI", true],
  ["ist-linux", "ist-ogrenci", "SECILDI", true],
  ["ist-olimpiyat", "ist-ogrenci", "SECILDI"],
  ["ist-espor", "ist-ogrenci", "BEKLIYOR"],
  ["ist-misafir", "ist-ogrenci", "REDDEDILDI"],
  ["ist-eticaret", "ist-ogrenci", "BEKLIYOR"],
  // İstanbul öğretmeni
  ["ist-ctf", "ist-ogretmen", "SECILDI", true],
  ["ist-g2s", "ist-ogretmen", "SECILDI", true],
  ["ist-olimpiyat", "ist-ogretmen", "BEKLIYOR"],
];

const GEREKCELER: Record<string, string[]> = {
  OGRENCI: [
    "Bu alanda kendimi geliştirmek istiyorum; kulüpte başladığım projeyi ilerletmek için iyi bir fırsat.",
    "Geçen yıl izleyici olarak katılmıştım, bu yıl takımımla yarışmak istiyorum.",
    "Danışman öğretmenim önerdi. Takım çalışması deneyimi kazanmak istiyorum.",
    "Üniversitede bu bölümü okumayı düşünüyorum, sektörü yakından tanımak istiyorum.",
  ],
  OGRETMEN: [
    "Okulumuzdaki öğrenci takımına rehberlik etmek için katılmak istiyorum.",
    "Etkinliği kendi okulumda uyarlamak için yerinde görmek istiyorum.",
  ],
};

// ---------------------------------------------------------------------------
// Yorumlar: [etkinlik, yazan, metin, yanıtladığı yorumun sırası]
// ---------------------------------------------------------------------------

const YORUMLAR: [string, string, string, number?][] = [
  ["ank-hack", "ank-ogrenci", "Harika bir deneyimdi, jüri geri bildirimleri çok faydalıydı. Takımımızın akıllı durak fikrini okulda geliştirmeye devam ediyoruz!"],
  ["ank-hack", "ank-koord", "Tebrikler Elif, sunumunuz çok netti. Zirve öncesi bir ara değerlendirme yapalım.", 0],
  ["ank-hack", "ank-ogretmen", "Öğrencilerimiz çok yoruldu ama çok mutlu döndüler. Mentörlere teşekkürler."],
  ["ank-maraton", "ank-ogrenci", "Soruların dili Türkçe mi olacak, İngilizce mi?"],
  ["ank-maraton", "ank-koord", "Sorular Türkçe olacak, örnek girdi/çıktılar İngilizce terim içerebilir.", 3],
  ["ank-robotik", "ank-ogretmen", "Sumo kategorisinde robot ağırlık sınırı geçen yılki gibi 3 kg mı?"],
  ["ank-robotik", "ank-koord", "Evet, 3 kg ve 20x20 cm. Kural kitapçığını ekler olarak paylaşacağız.", 5],
  ["ank-sera", "ank-ogrenci", "Seramızdaki fesleğenler filizlendi 🌱 Nem sensörünün eşik değerini 40'a çektik."],
  ["ank-siber", "ank-ogrenci", "Arkadaşlarımı da getirebilir miyim? Kontenjan yeterli görünüyor."],
  ["ank-siber", "ank-ogretmen", "Tabii, herkes kendi hesabından başvursun yeter.", 8],
  ["ist-ctf", "ist-ogrenci", "Kriptografi sorularından biri çok zordu ama çözünce inanılmaz keyif verdi. Gelecek yıl yine katılacağız."],
  ["ist-ctf", "ist-koord", "Çözüm yazılarınızı çalışma grubu sayfasında paylaşırsanız diğer takımlar da öğrenir.", 10],
  ["ist-ctf", "ist-ogretmen", "Altyapı çok iyi hazırlanmıştı, emeği geçenlere teşekkürler."],
  ["ist-sahne", "ist-ogrenci", "Sahneye çıkmadan önce çok heyecanlıydım, sonrasında çok rahatladım. Geri bildirimleri not aldım."],
  ["ist-olimpiyat", "ist-ogrenci", "Deneme sınavı hangi platformda yapılacak?"],
  ["ist-olimpiyat", "ist-koord", "Kampta kendi değerlendirme sistemimizi kullanacağız; bağlantıyı kamp günü paylaşacağız.", 14],
  ["ist-espor", "ist-ogretmen", "Takım kadroları kaç kişi olacak, yedek oyuncu yazabiliyor muyuz?"],
  ["ist-web", "ist-ogrenci", "Site yayında! Kulüp başvuruları artık formdan geliyor."],
  ["ist-eticaret", "ist-ogrenci", "Fikirleri takım olarak mı sunuyoruz, bireysel de olur mu?"],
  ["ist-eticaret", "ist-ogretmen", "En az 2, en fazla 4 kişilik takımlar halinde.", 18],
];

// ---------------------------------------------------------------------------
// Kazanım, hedef ve gönderi
// ---------------------------------------------------------------------------

interface KazanimTanimi {
  kisi: string;
  tip: KazanimTipi;
  baslik: string;
  aciklama?: string;
  tarih: string;
  derece?: string;
  duzenleyen?: string;
  bicim?: KatilimBicimi;
  program?: string;
  baglantiUrl?: string;
  gelistirenEkip?: string;
  hedefKitle?: string;
}

const KAZANIMLAR: KazanimTanimi[] = [
  // Elif (Ankara öğrencisi)
  { kisi: "ank-ogrenci", tip: "YARISMA_DERECESI", baslik: "Hack The Idea Ankara — İl Üçüncülüğü", derece: "İl 3.'sü", duzenleyen: "Ankara GençTek İl Koordinatörlüğü", tarih: "2026-05-17", aciklama: "Akıllı durak projesiyle takım olarak il üçüncüsü olduk." },
  { kisi: "ank-ogrenci", tip: "URUN", baslik: "Akıllı Sera Otomasyonu", aciklama: "Arduino ve nem sensörüyle otomatik sulama yapan mini sera. Kodu açık kaynak.", tarih: "2026-04-30", gelistirenEkip: "Elif Yıldız, okul robotik takımı", hedefKitle: "Okul bahçeleri ve sınıf içi deneyler", baglantiUrl: "https://github.com/ornek/akilli-sera" },
  { kisi: "ank-ogrenci", tip: "SERTIFIKA", baslik: "Python ile Programlamaya Giriş", duzenleyen: "Çevrim içi eğitim platformu", bicim: "ONLINE", tarih: "2026-02-11" },
  { kisi: "ank-ogrenci", tip: "DIS_ETKINLIK", baslik: "TEKNOFEST Robotaksi Yarışması — izleyici katılım", duzenleyen: "TEKNOFEST", bicim: "YUZ_YUZE", tarih: "2025-09-20" },
  { kisi: "ank-ogrenci", tip: "AKRAN_EGITIMI", baslik: "9. sınıflara Scratch oturumu", aciklama: "İki ders saati boyunca 22 öğrenciye blok kodlamayla oyun yapmayı anlattım.", bicim: "YUZ_YUZE", hedefKitle: "9. sınıf öğrencileri", tarih: "2026-03-05" },
  { kisi: "ank-ogrenci", tip: "TOPLULUK", baslik: "Okul Robotik Takımı", aciklama: "Yazılım sorumlusuyum.", tarih: "2025-10-01" },
  { kisi: "ank-ogrenci", tip: "GENCTEK_ETKINLIGI", baslik: "Dijital Yürüyüş STEM 2025", program: "Dijital Yürüyüş STEM", bicim: "YUZ_YUZE", tarih: "2025-11-08" },
  // Arda (İstanbul öğrencisi)
  { kisi: "ist-ogrenci", tip: "YARISMA_DERECESI", baslik: "İstanbul Liseler Arası CTF — İl Birinciliği", derece: "İl 1.'si", duzenleyen: "İstanbul GençTek İl Koordinatörlüğü", tarih: "2026-05-09", aciklama: "Üç kişilik takımımızla 14 bayrağın 11'ini yakaladık." },
  { kisi: "ist-ogrenci", tip: "URUN", baslik: "Kulüpler Web Sitesi", aciklama: "Okul kulüplerinin tanıtım ve başvuru sayfası. Ön yüz ekibindeydim.", tarih: "2026-04-03", gelistirenEkip: "Web programlama kulübü", hedefKitle: "Okul öğrencileri", baglantiUrl: "https://ornek-okul.example/kulupler" },
  { kisi: "ist-ogrenci", tip: "URUN", baslik: "Parola Gücü Ölçer Tarayıcı Eklentisi", aciklama: "Girilen parolanın tahmin edilme süresini yerelde hesaplayan küçük bir eklenti.", tarih: "2026-08-14", gelistirenEkip: "Arda Çelik" },
  { kisi: "ist-ogrenci", tip: "SERTIFIKA", baslik: "Siber Güvenliğe Giriş Eğitimi", duzenleyen: "Çevrim içi eğitim platformu", bicim: "ONLINE", tarih: "2026-01-22" },
  { kisi: "ist-ogrenci", tip: "AKRAN_EGITIMI", baslik: "Linux temelleri — kulüp içi sunum", bicim: "YUZ_YUZE", hedefKitle: "Kulüp üyeleri", tarih: "2026-06-02" },
  { kisi: "ist-ogrenci", tip: "DIS_ETKINLIK", baslik: "Açık kaynak yaz kampı", duzenleyen: "Gönüllü açık kaynak topluluğu", bicim: "KARMA", tarih: "2026-07-20" },
  // Öğretmenler ve koordinatörler
  { kisi: "ank-ogretmen", tip: "SERTIFIKA", baslik: "Eğitimde Robotik Kodlama Formatör Eğitimi", duzenleyen: "MEB YEĞİTEK", bicim: "YUZ_YUZE", tarih: "2025-08-25" },
  { kisi: "ank-ogretmen", tip: "URUN", baslik: "Robotik Atölyesi Ders Planları", aciklama: "12 haftalık, açık lisanslı Arduino atölye planları.", tarih: "2026-01-15", gelistirenEkip: "Selin Korkmaz" },
  { kisi: "ist-ogretmen", tip: "SERTIFIKA", baslik: "Mobil Uygulama Geliştirme Öğretmen Eğitimi", duzenleyen: "MEB YEĞİTEK", bicim: "ONLINE", tarih: "2026-02-20" },
  { kisi: "ist-ogretmen", tip: "DIS_ETKINLIK", baslik: "Eğitim Teknolojileri Zirvesi — konuşmacı", duzenleyen: "Eğitim teknolojileri derneği", bicim: "YUZ_YUZE", tarih: "2026-04-12" },
  { kisi: "ank-koord", tip: "DIS_ETKINLIK", baslik: "İl Koordinatörleri Çalıştayı", duzenleyen: "MEB YEĞİTEK", bicim: "YUZ_YUZE", tarih: "2026-09-02" },
  { kisi: "ist-koord", tip: "SERTIFIKA", baslik: "Proje Yönetimi Temelleri", duzenleyen: "Çevrim içi eğitim platformu", bicim: "ONLINE", tarih: "2026-03-10" },
];

const HEDEFLER: { kisi: string; baslik: string; aciklama: string; durum: "PLANLANDI" | "SURUYOR" | "TAMAMLANDI"; tarih: string }[] = [
  { kisi: "ank-ogrenci", baslik: "TEKNOFEST'e takımla başvurmak", aciklama: "Robotik takımımızla insansız kara aracı kategorisine başvuru.", durum: "SURUYOR", tarih: "2027-02-15" },
  { kisi: "ank-ogrenci", baslik: "Makine öğrenmesi kursunu bitirmek", aciklama: "Haftada 3 saat ayırarak çevrim içi kursu tamamlamak.", durum: "SURUYOR", tarih: "2026-12-31" },
  { kisi: "ank-ogrenci", baslik: "İlk açık kaynak katkımı yapmak", aciklama: "Bir projeye belge ya da hata düzeltmesi göndermek.", durum: "PLANLANDI", tarih: "2027-03-01" },
  { kisi: "ank-ogrenci", baslik: "Hack The Idea'da derece almak", aciklama: "", durum: "TAMAMLANDI", tarih: "2026-05-17" },
  { kisi: "ist-ogrenci", baslik: "Ulusal CTF'de ilk 10'a girmek", aciklama: "Takımla haftalık pratik oturumları.", durum: "SURUYOR", tarih: "2027-04-30" },
  { kisi: "ist-ogrenci", baslik: "Bilgisayar Olimpiyatı ikinci aşamaya kalmak", aciklama: "Algoritma çalışma planı: her gün 2 soru.", durum: "PLANLANDI", tarih: "2027-01-20" },
  { kisi: "ist-ogrenci", baslik: "Kulüp sitesini yayına almak", aciklama: "", durum: "TAMAMLANDI", tarih: "2026-04-03" },
];

const GONDERILER: { kisi: string; icerik: string; tarih: string; yorumlar?: [string, string][] }[] = [
  { kisi: "ank-koord", tarih: "2026-09-15", icerik: "2026-2027 Ankara GençTek takvimi yayında! Tek Maraton ve Robotik Şenliği başvuruları açıldı. Danışman öğretmenlerimiz öğrencilerini yönlendirebilir.", yorumlar: [["ank-ogretmen", "Robotik takımımız hazır, başvurularımızı yapıyoruz."], ["ank-ogrenci", "Maraton için şimdiden çalışmaya başladım!"]] },
  { kisi: "ank-koord", tarih: "2026-09-10", icerik: "Başkentte Yapay Zekâ Günleri'ne katılan tüm öğrencilere teşekkürler. Atölye materyalleri çalışma grubu sayfasında." },
  { kisi: "ank-ogretmen", tarih: "2026-09-18", icerik: "Okulumuzda Siber Güvenlik Farkındalık Semineri düzenliyoruz; 7 Ekim'de tüm öğrencilerimizi bekliyoruz.", yorumlar: [["ank-ogrenci", "Sınıfça geliyoruz 🙌"]] },
  { kisi: "ank-ogretmen", tarih: "2026-05-02", icerik: "Akıllı sera atölyemizin ürünleri bahçede! Öğrencilerimizin emeğine sağlık." },
  { kisi: "ank-ogrenci", tarih: "2026-05-18", icerik: "Hack The Idea Ankara'da takımımızla üçüncü olduk! Akıllı durak fikrimizi geliştirmeye devam edeceğiz. Mentörlerimize ve öğretmenime teşekkürler.", yorumlar: [["ank-ogretmen", "Seninle gurur duyuyoruz Elif!"], ["ist-ogrenci", "Tebrikler! Zirvede görüşürüz."], ["ank-koord", "Tebrikler, harika iş çıkardınız."]] },
  { kisi: "ank-ogrenci", tarih: "2026-09-12", icerik: "Yapay Zekâ Günleri'nde ilk görüntü sınıflandırma modelimi eğittim: %87 doğruluk. Sırada veri artırma var." },
  { kisi: "ist-koord", tarih: "2026-09-16", icerik: "İstanbul'da Bilgisayar Olimpiyatlarına Hazırlık Kampı ve Espor Turnuvası başvuruları açık. Kontenjanlar sınırlı!", yorumlar: [["ist-ogretmen", "Kamp için öğrencilerimize duyurduk."]] },
  { kisi: "ist-koord", tarih: "2026-06-14", icerik: "Sahne Senin'de 34 proje sunuldu, salon doldu taştı. Katılan tüm öğrenci ve öğretmenlerimize teşekkürler." },
  { kisi: "ist-ogretmen", tarih: "2026-04-04", icerik: "Web kulübümüzün hazırladığı kulüpler sitesi yayında. İki haftalık sprintin sonunda öğrencilerimiz gerçek bir ürün çıkardı.", yorumlar: [["ist-ogrenci", "Ön yüz ekibinde olmak çok öğreticiydi."]] },
  { kisi: "ist-ogretmen", tarih: "2026-09-20", icerik: "G2S buluşmasında mentörlük masaları çok verimliydi. Öğrencilerimizin soruları sektör temsilcilerini de etkiledi." },
  { kisi: "ist-ogrenci", tarih: "2026-05-10", icerik: "İstanbul Liseler Arası CTF'de il birincisi olduk! 🏁 Kriptografi kategorisindeki son soruyu bitime 3 dakika kala çözdük.", yorumlar: [["ist-koord", "Tebrikler, çözüm yazılarınızı bekliyoruz."], ["ank-ogrenci", "Müthiş! Bize de CTF anlatır mısın?"], ["ist-ogrenci", "Tabii, çevrim içi bir oturum yapabiliriz."]] },
  { kisi: "ist-ogrenci", tarih: "2026-08-15", icerik: "Yaz tatilinde küçük bir tarayıcı eklentisi yazdım: parolanızın tahmin edilme süresini gösteriyor. Geri bildirimlere açığım." },
];

// ---------------------------------------------------------------------------
// Ana akış
// ---------------------------------------------------------------------------

async function main() {
  if (process.argv.includes("--temizle")) {
    await uretilenleriSil();
    return;
  }

  const mevcut = await prisma.kullanici.count({
    where: { authProviderId: { in: KISILER.map((k) => k.tc) } },
  });
  if (mevcut > 0) {
    console.error(
      "Pilot kullanıcılar zaten var. Yeniden üretmek için önce: npm run veri:pilot -- --temizle",
    );
    process.exitCode = 1;
    return;
  }

  // Bir ilin aynı anda tek aktif koordinatörü olabilir (ux_il_koordinator_tek_aktif).
  const doluIller = await prisma.kullaniciRol.findMany({
    where: { rolKodu: "IL_KOORDINATOR", bitisTarihi: null, ilKodu: { in: ["06", "34"] } },
    select: { ilKodu: true, kullanici: { select: { ad: true, soyad: true } } },
  });
  if (doluIller.length > 0) {
    for (const d of doluIller) {
      console.error(
        `${IL_ADLARI[d.ilKodu as "06" | "34"]} ilinin zaten aktif koordinatörü var: ${d.kullanici.ad} ${d.kullanici.soyad}.`,
      );
    }
    console.error("Pilot koordinatör atanamaz; hiçbir şey yazılmadı.");
    process.exitCode = 1;
    return;
  }

  console.log("1. Kişiler");
  const kisiler = await kisileriOlustur();

  const programlar = new Map(
    (await prisma.temelEtkinlikProgrami.findMany({ select: { id: true, ad: true } })).map(
      (p) => [p.ad, p.id],
    ),
  );
  const gruplar = new Map(
    (await prisma.calismaGrubu.findMany({ where: { aktif: true }, select: { id: true, ad: true } })).map(
      (g) => [g.ad, g.id],
    ),
  );

  console.log("2. Etkinlikler");
  const etkinlikler = new Map<string, { id: number; tanim: EtkinlikTanimi }>();
  for (const t of E) {
    const duzenleyen = kisiler[t.duzenleyen];
    const ilAdi = IL_ADLARI[duzenleyen.ilKodu];
    const bitis = t.gunSuresi ? gunEkle(t.tarih, t.gunSuresi) : null;
    const [acilis, kapanis] = t.pencere ?? [40, 7];
    const basvuruBaslangic = gunEkle(t.tarih, -acilis);
    const basvuruBitis = gunEkle(t.tarih, -kapanis);
    const olusturma = gunEkle(basvuruBaslangic, -3);
    const onay = t.onay ?? "ONAY_GEREKMEZ";

    // Birim adı ve yer, uygulamanın kuralıyla aynı: okul kapsamı okula,
    // il kapsamı düzenleyenin iline, ulusal/uluslararası hiçbir yere bağlı.
    const duzenleyenBirim =
      t.kapsam === "OKUL"
        ? (duzenleyen.kurumAdi ?? "Okul")
        : t.kapsam === "IL" || duzenleyen.rol === "KOORDINATOR"
          ? `${ilAdi} İl Koordinatörlüğü`
          : "MEB YEĞİTEK";

    const programId = t.program ? programlar.get(t.program) : undefined;
    if (t.program && !programId) throw new Error(`Program bulunamadı: ${t.program}`);

    const kayit = await prisma.faaliyet.create({
      data: {
        ad: t.ad,
        aciklama: t.aciklama,
        tarih: t.tarih,
        bitisTarihi: bitis,
        katilimBicimi: t.bicim,
        hedefKitle: t.hedefKitle,
        kapsam: t.kapsam,
        etkinlikKategorisi: t.kategori,
        temelEtkinlikProgramiId: programId ?? null,
        kurumKodu: t.kapsam === "OKUL" ? duzenleyen.kurumKodu : null,
        ilKodu: t.kapsam === "IL" ? duzenleyen.ilKodu : null,
        kontenjan: t.kontenjan,
        duzenleyenKullaniciId: duzenleyen.id,
        duzenleyenBirim,
        onayDurumu: onay,
        onaylayanKullaniciId: t.onaylayan ? kisiler[t.onaylayan].id : null,
        onayTarihi: t.onaylayan ? gunEkle(olusturma, 1) : null,
        basvuruBaslangic,
        basvuruBitis,
        olusturmaTarihi: olusturma,
        durum: t.iptal ? "IPTAL_EDILDI" : "AKTIF",
        iptalGerekcesi: t.iptal ?? null,
        iptalEdenKullaniciId: t.iptal ? duzenleyen.id : null,
        iptalTarihi: t.iptal ? gun("2026-09-22") : null,
        calismaGruplari: {
          create: (t.gruplar ?? []).map((ad) => {
            const id = gruplar.get(ad);
            if (!id) throw new Error(`Çalışma grubu bulunamadı: ${ad}`);
            return { calismaGrubuId: id };
          }),
        },
      },
      select: { id: true },
    });
    etkinlikler.set(t.kod, { id: kayit.id, tanim: t });

    if (t.rapor) {
      await prisma.faaliyetRaporu.create({
        data: {
          faaliyetId: kayit.id,
          degerlendirme: t.rapor.degerlendirme,
          kazanimlar: t.rapor.kazanimlar,
          yazanKullaniciId: duzenleyen.id,
          olusturmaTarihi: gunEkle(bitis ?? t.tarih, 2),
        },
      });
    }
  }
  console.log(`   ${etkinlikler.size} etkinlik`);

  console.log("3. Başvurular, yoklama ve belgeler");
  let belgeSayisi = 0;
  for (const [i, [kod, kisiAnahtari, durum, katildi]] of BASVURULAR.entries()) {
    const e = etkinlikler.get(kod)!;
    const kisi = kisiler[kisiAnahtari];
    const duzenleyenId = kisiler[e.tanim.duzenleyen].id;
    const basvuruTarihi = gunEkle(e.tanim.tarih, -(e.tanim.pencere?.[0] ?? 40) + 2 + (i % 5));
    const karara = durum === "SECILDI" || durum === "REDDEDILDI" || durum === "YEDEK";
    const gecmis = e.tanim.tarih < new Date();
    const gerekceler = GEREKCELER[kisi.rol === "OGRENCI" ? "OGRENCI" : "OGRETMEN"];

    await prisma.basvuru.create({
      data: {
        faaliyetId: e.id,
        katilimciId: kisi.id,
        gerekce: gerekceler[i % gerekceler.length],
        durum,
        basvuruTarihi,
        geriCekmeTarihi: durum === "GERI_CEKILDI" ? gunEkle(basvuruTarihi, 3) : null,
        degerlendirenKullaniciId: karara ? duzenleyenId : null,
        degerlendirmeTarihi: karara ? gunEkle(basvuruTarihi, 4) : null,
        katildiMi: gecmis && katildi !== undefined ? katildi : null,
        yoklamaAlanKullaniciId: gecmis && katildi !== undefined ? duzenleyenId : null,
        yoklamaTarihi: gecmis && katildi !== undefined ? e.tanim.tarih : null,
      },
    });

    if (gecmis && katildi) {
      await prisma.faaliyetBelgesi.create({
        data: {
          faaliyetId: e.id,
          katilimciId: kisi.id,
          tur: "KATILIM",
          uretenKullaniciId: duzenleyenId,
          uretimTarihi: gunEkle(e.tanim.tarih, (e.tanim.gunSuresi ?? 0) + 3),
        },
      });
      belgeSayisi += 1;
    }
  }
  console.log(`   ${BASVURULAR.length} başvuru · ${belgeSayisi} katılım belgesi`);

  console.log("4. Yorumlar");
  const yorumIdleri: number[] = [];
  for (const [kod, yazan, icerik, ust] of YORUMLAR) {
    const e = etkinlikler.get(kod)!;
    const tabanTarih = e.tanim.tarih < new Date() ? gunEkle(e.tanim.tarih, 1) : gunEkle(e.tanim.tarih, -12);
    const y = await prisma.yorum.create({
      data: {
        faaliyetId: e.id,
        yazanKullaniciId: kisiler[yazan].id,
        ustYorumId: ust !== undefined ? yorumIdleri[ust] : null,
        icerik,
        olusturmaTarihi: gunEkle(tabanTarih, ust !== undefined ? 0.2 : 0),
      },
      select: { id: true },
    });
    yorumIdleri.push(y.id);
  }
  console.log(`   ${YORUMLAR.length} yorum`);

  console.log("5. Kazanımlar, hedefler, çalışma grupları");
  for (const k of KAZANIMLAR) {
    await prisma.kullaniciKazanim.create({
      data: {
        kullaniciId: kisiler[k.kisi].id,
        tip: k.tip,
        baslik: k.baslik,
        aciklama: k.aciklama ?? null,
        tarih: gun(k.tarih),
        derece: k.derece ?? null,
        duzenleyen: k.duzenleyen ?? null,
        katilimBicimi: k.bicim ?? null,
        temelEtkinlikProgramiId: k.program ? (programlar.get(k.program) ?? null) : null,
        baglantiUrl: k.baglantiUrl ?? null,
        gelistirenEkip: k.gelistirenEkip ?? null,
        hedefKitle: k.hedefKitle ?? null,
        olusturmaTarihi: gunEkle(gun(k.tarih), 2),
      },
    });
  }
  for (const h of HEDEFLER) {
    await prisma.kullaniciHedefi.create({
      data: {
        kullaniciId: kisiler[h.kisi].id,
        baslik: h.baslik,
        aciklama: h.aciklama || null,
        durum: h.durum,
        hedefTarihi: new Date(`${h.tarih}T00:00:00Z`),
        tamamlanmaTarihi: h.durum === "TAMAMLANDI" ? gun(h.tarih) : null,
      },
    });
  }
  const grupSecimleri: [string, string[]][] = [
    ["ank-ogrenci", ["Yapay Zekâ", "Robotik", "Bilgisayar Olimpiyatları"]],
    ["ist-ogrenci", ["Siber Güvenlik", "Web Programlama", "Açık Kaynak"]],
  ];
  for (const [kisi, adlar] of grupSecimleri) {
    await prisma.ogrenciCalismaGrubu.createMany({
      data: adlar.map((ad) => ({
        ogrenciId: kisiler[kisi].id,
        calismaGrubuId: gruplar.get(ad)!,
        secimTarihi: gun("2025-10-01"),
      })),
    });
  }
  console.log(`   ${KAZANIMLAR.length} kazanım · ${HEDEFLER.length} hedef`);

  console.log("6. Gönderiler");
  let gonderiYorumu = 0;
  for (const g of GONDERILER) {
    const tarih = gun(g.tarih, "18:30");
    const gonderi = await prisma.gonderi.create({
      data: { yazanKullaniciId: kisiler[g.kisi].id, icerik: g.icerik, olusturmaTarihi: tarih },
      select: { id: true },
    });
    for (const [j, [yazan, icerik]] of (g.yorumlar ?? []).entries()) {
      await prisma.gonderiYorumu.create({
        data: {
          gonderiId: gonderi.id,
          yazanKullaniciId: kisiler[yazan].id,
          icerik,
          olusturmaTarihi: new Date(tarih.getTime() + (j + 1) * 47 * 60_000),
        },
      });
      gonderiYorumu += 1;
    }
  }
  console.log(`   ${GONDERILER.length} gönderi · ${gonderiYorumu} yorum`);

  // Giriş bilgileri — yalnızca burada görünür, hiçbir yere yazılmaz.
  console.log("\nGiriş bilgileri (T.C. + şifre):");
  const ROL_ADI: Record<Rol, string> = {
    KOORDINATOR: "İl koordinatörü",
    OGRETMEN: "Öğretmen",
    OGRENCI: "Öğrenci",
  };
  console.table(
    Object.values(kisiler).map((k) => ({
      il: IL_ADLARI[k.ilKodu],
      rol: ROL_ADI[k.rol],
      "ad soyad": `${k.ad} ${k.soyad}`,
      okul: k.kurumAdi ?? "—",
      tc: k.tc,
      sifre: k.sifre,
    })),
  );
}

main()
  .catch((hata) => {
    console.error(hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

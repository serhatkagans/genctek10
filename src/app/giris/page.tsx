import {
  Building2,
  ChevronLeft,
  GraduationCap,
  Info,
  LogIn,
  MapPin,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ILLER } from "../../../prisma/veri/iller";
import { TemaSecici } from "@/components/TemaSecici";
import { authProvider } from "@/lib/auth";
import type { AuthKimlik } from "@/lib/auth/tipler";
import { prisma } from "@/lib/db";
import { ortam } from "@/lib/ortam";
import { aktifTema } from "@/lib/tema";
import { guvenliDonusYolu } from "@/lib/auth/donus-yolu";
import { oturumKullanicisi } from "@/lib/auth/oturum";
import { girisEylemi } from "./eylemler";
import { SifreliGiris } from "./SifreliGiris";

/**
 * Giriş ekranı.
 *
 * Mock aşamada kimlik doğrulama, katalogdan bir test kullanıcısı seçmekten
 * oluşur — şifre veya kayıt akışı yoktur, EBA da bunu yapmayacak. EBA SSO
 * bağlandığında bu ekran yerini SSO yönlendirmesine bırakır; alt katmanlar
 * değişmez.
 *
 * Kimlikler dört yetki senaryosuna göre gruplanır (YEĞİTEK, il koordinatörü,
 * danışman öğretmen, öğrenci), çünkü test edilen şey kişi değil o rolün ne
 * görüp ne yapabildiğidir. Gruplama sabit listeden değil veritabanındaki aktif
 * rollerden gelir: bir öğretmen danışmanlık görevini bıraktığında kartı
 * kendiliğinden son gruba düşer.
 *
 * TEK İSTİSNA, HENÜZ HİÇ GİRMEMİŞ ÖĞRETMEN: kaydı olmadığı için rolü de
 * yoktur, ama ilk girişinde danışman olacaktır (bkz. lib/kullanici/sagla.ts).
 * Ekran bunu önden gösterir, yoksa listede giriş yapıldığı anda kaybolan bir
 * "görev almamış öğretmen" grubu dururdu (bkz. senaryoBelirle).
 */

export const dynamic = "force-dynamic";

type Ikon = React.ComponentType<{ size?: number; className?: string }>;

const SENARYO_TANIMLARI = [
  {
    kod: "yegitek",
    baslik: "YEĞİTEK — proje yöneticisi",
    aciklama:
      "Tüm illeri görür, ulusal etkinlikleri onaylar, il koordinatörü rolü atar.",
    Ikon: UserCog as Ikon,
    seritSinifi: "border-l-rol-yonetici-metin",
  },
  {
    kod: "il",
    baslik: "İl koordinatörü",
    aciklama:
      "Yalnızca kendi ilini görür; okulunda danışman bulunmayan öğrencilerin danışmanıdır.",
    Ikon: MapPin as Ikon,
    seritSinifi: "border-l-rol-koordinator-metin",
  },
  {
    kod: "okul",
    baslik: "Danışman öğretmen — GençTek danışman öğretmeni",
    aciklama:
      "Yalnızca danışmanlığındaki öğrencileri görür, okulunda etkinlik açar.",
    Ikon: ShieldCheck as Ikon,
    seritSinifi: "border-l-rol-danisman-metin",
  },
  {
    kod: "ogrenci",
    baslik: "Öğrenci",
    aciklama:
      "Kendi profilini, danışmanını ve çalışma gruplarını yönetir; başka öğrenciyi göremez.",
    Ikon: GraduationCap as Ikon,
    seritSinifi: "border-l-rol-ogrenci-metin",
  },
  {
    /*
      27 Ağustos 2026 · istek: "bu onay var buna gerek yok, sisteme giriş
      yapınca direk danışman olsun". Açıklama, kalkan "görevi işaretle"
      düğmesini anlatmayı sürdürüyordu.

      GRUP ARTIK ÇOĞU KURULUMDA BOŞ ve boş grup hiç basılmıyor (aşağıda
      `grup.length === 0` dalı): okulu kayıtlı öğretmen, giriş yapmamış olsa
      bile danışman grubunda listeleniyor (bkz. senaryoBelirle). Başlık
      silinmedi çünkü iki gerçek durum kaldı — okulsuz kayıt ve görevini
      bırakmış öğretmen.
    */
    kod: "gorevsiz",
    baslik: "Görev almamış öğretmen",
    aciklama:
      "Sisteme girer ama hiçbir öğrenci verisi göremez. Danışmanlık görevi ilk girişte kendiliğinden açıldığı için burada yalnızca okul kaydı eksik olan (görev okula bağlandığı için rol verilemez) ya da görevini bırakmış öğretmen kalır.",
    Ikon: Building2 as Ikon,
    seritSinifi: "border-l-cizgi",
  },
] as const;

type SenaryoKodu = (typeof SENARYO_TANIMLARI)[number]["kod"];

/**
 * Bir senaryo başlığı altında en fazla kaç kart gösterilir.
 *
 * Sınır KALDIRILABİLİR: başlıktaki "tümünü göster" bağlantısı o grubu açar
 * (bkz. `tumu` parametresi). 12 Ağustos 2026 · istek: "danışman olmak istiyorum
 * düğmesine basınca öğretmen listeden siliniyor" — kart silinmiyordu, görevi
 * işaretleyen öğretmen danışman grubuna geçiyor ve o grup 25 kartta kırpıldığı
 * için aranan kişi kırpılan kısımda kalıyordu. Kırpma sessiz değildi ama
 * "… ve N kişi daha" satırı da kişiye ulaşmanın bir yolunu vermiyordu.
 */
const GOSTERIM_SINIRI = 25;

function KimlikKarti({
  kimlik,
  altBilgi,
  seritSinifi,
  nereye,
}: {
  kimlik: AuthKimlik;
  altBilgi: string;
  seritSinifi: string;
  /** Girişten sonra açılacak sayfa; portaldan gelen bağlantı bunu taşır. */
  nereye: string | null;
}) {
  return (
    <form action={girisEylemi}>
      <input type="hidden" name="kimlikBilgisi" value={kimlik.authProviderId} />
      {nereye && <input type="hidden" name="nereye" value={nereye} />}
      <button
        type="submit"
        className={`group flex w-full items-center justify-between gap-3 rounded-kart border border-l-4 border-cizgi bg-kart px-4 py-3 text-left transition hover:border-vurgu ${seritSinifi}`}
      >
        <span>
          <span className="block font-medium text-metin">
            {kimlik.ad} {kimlik.soyad}
          </span>
          <span className="block text-sm text-metin-yumusak">{altBilgi}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-vurgu-metin opacity-0 transition group-hover:opacity-100">
          Giriş yap
          <LogIn size={15} aria-hidden />
        </span>
      </button>
    </form>
  );
}

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    hata?: string;
    ara?: string;
    tumu?: string;
    /**
     * Girişten sonra açılacak sayfa (20 Ağustos 2026 · istek: "az önceki
     * uygulamadaki sayfaya gitmesi gerek ama girişten sonra").
     *
     * Tanıtım portalındaki etkinlik kartı buraya `?nereye=/panel/etkinlikler/12`
     * ile bağlanıyor. Değer adres çubuğundan geldiği için doğrudan
     * kullanılmaz; `guvenliDonusYolu` uygulama dışına çıkan her şeyi eler.
     */
    nereye?: string;
    /** Kayıt formundan dönüşte "kaydınız oluşturuldu" kutusu için. */
    kayit?: string;
  }>;
}) {
  const { hata, ara, tumu, nereye: hamNereye, kayit } = await searchParams;
  const nereye = guvenliDonusYolu(hamNereye);

  /*
   * OTURUMU OLAN ZİYARETÇİ GİRİŞ EKRANINI HİÇ GÖRMEZ, doğrudan hedefe gider.
   *
   * Bu, tanıtım portalından gelen bağlantının çalışması için ŞART. Portal
   * kartı `/giris?nereye=/panel/etkinlikler/12` adresine bağlanıyor: ziyaretçi
   * çoğunlukla oturumsuz olduğu için giriş ekranı doğru karşılamadır, ama
   * zaten girmiş olan kişiye "tekrar giriş yapın" demek, elindeki oturumu yok
   * saymak olurdu.
   *
   * KAPI PANELİN KENDİSİNDEN GEÇİYOR: buradaki kontrol yalnızca "oturum var
   * mı" diye soruyor; ilk giriş onayı, danışman seçimi gibi kapılar panel
   * düzeninde duruyor ve hedef sayfa açılırken yine çalışıyorlar.
   *
   * Yalnızca `nereye` VARKEN çalışır: parametresiz /giris adresine gelen kişi
   * (ör. çıkış yapıp yeniden başkası olarak girmek isteyen) ekranı görmeye
   * devam eder.
   */
  if (nereye && (await oturumKullanicisi())) {
    redirect(nereye);
  }

  /*
   * KAYIT KİPİ (17 Eylül 2026 · istek: "login ekranında kayıt olacak
   * kullanıcı ve sonra giriş yapacak, mevcut girişi değiştirelim"). Kimlik
   * listesi hiç çekilmez; aşağıdaki ekran yalnızca mock kipinde basılır.
   */
  if (ortam.AUTH_PROVIDER === "kayit") {
    return (
      <SifreliGiris
        hata={hata}
        kayitTamam={kayit === "tamam"}
        nereye={nereye}
      />
    );
  }
  const aranan = (ara ?? "").trim().toLocaleLowerCase("tr");
  const [tema, kimlikler] = await Promise.all([
    aktifTema(),
    authProvider().secilebilirKimlikler(),
  ]);

  const kurumlar = await prisma.kurum.findMany({
    select: { kurumKodu: true, ad: true },
  });
  const kurumAdlari = new Map(kurumlar.map((k) => [k.kurumKodu, k.ad]));

  // Senaryo grubu, sabit listeden değil kullanıcının o anki aktif rollerinden
  // belirlenir.
  const aktifRoller = await prisma.kullaniciRol.findMany({
    where: { bitisTarihi: null },
    select: {
      rolKodu: true,
      ilKodu: true,
      kullanici: { select: { authProviderId: true } },
    },
  });

  const rolHaritasi = new Map<string, typeof aktifRoller>();
  for (const rol of aktifRoller) {
    const anahtar = rol.kullanici.authProviderId;
    rolHaritasi.set(anahtar, [...(rolHaritasi.get(anahtar) ?? []), rol]);
  }

  /*
   * KAYDI OLANLAR — "hiç girmemiş" ile "girmiş ama rolsüz" farkı.
   *
   * Rol tablosu bu iki durumu ayırt etmiyor: ikisinde de aktif rol yok. Ama
   * anlamları zıt. Kaydı hiç olmayan öğretmen ilk girişinde DANIŞMAN olacak
   * (bkz. lib/kullanici/sagla.ts); kaydı olup rolü olmayan öğretmen ise görevi
   * BIRAKMIŞ kişidir ve girişi onu yeniden danışman yapmaz.
   */
  const kayitliKullanicilar = await prisma.kullanici.findMany({
    select: { authProviderId: true },
  });
  const kayitliMi = new Set(kayitliKullanicilar.map((k) => k.authProviderId));

  /**
   * Kimlik giriş yaptığında DANIŞMAN rolü kendiliğinden açılacak mı?
   *
   * 27 Ağustos 2026 · istek: "sisteme giriş yapınca direk danışman olsun".
   * Koşullar sağlama koduyla birebir aynı olmalı, yoksa ekran giriş sonrası
   * gerçekleşmeyecek bir söz vermiş olur.
   */
  function girisDanismanYaparMi(kimlik: AuthKimlik): boolean {
    return (
      kimlik.tip === "OGRETMEN" &&
      kimlik.kurumKodu !== null &&
      !kayitliMi.has(kimlik.authProviderId)
    );
  }

  function senaryoBelirle(kimlik: AuthKimlik): SenaryoKodu {
    const roller = rolHaritasi.get(kimlik.authProviderId) ?? [];
    if (roller.some((r) => r.rolKodu === "PROJE_YONETICISI")) return "yegitek";
    if (roller.some((r) => r.rolKodu === "IL_KOORDINATOR")) return "il";
    if (roller.some((r) => r.rolKodu === "DANISMAN")) return "okul";
    if (kimlik.tip === "OGRENCI") return "ogrenci";
    /*
     * HENÜZ GİRMEMİŞ ÖĞRETMEN DANIŞMAN GRUBUNDA (30 Ağustos 2026 · istek:
     * "görev almamış öğretmen diye bir şey yok artık hepsi danışman
     * statüsünde"). Rol veritabanında değil çünkü kişi hiç giriş yapmadı;
     * kartına basıldığı anda oluşacak. Son grupta bırakmak, ekranın kalkmış
     * bir akışı (öğretmenin görevi kendisi işaretlemesi) anlatması olurdu.
     */
    if (girisDanismanYaparMi(kimlik)) return "okul";
    return "gorevsiz";
  }

  function altBilgi(kimlik: AuthKimlik, senaryo: SenaryoKodu): string {
    const okul = kimlik.kurumKodu
      ? kurumAdlari.get(kimlik.kurumKodu) ?? null
      : null;
    const roller = rolHaritasi.get(kimlik.authProviderId) ?? [];

    if (senaryo === "yegitek") return "YEĞİTEK merkez · tüm iller";
    if (senaryo === "il") {
      const il = roller.find((r) => r.rolKodu === "IL_KOORDINATOR")?.ilKodu;
      return `İl kodu ${il ?? kimlik.ilKodu ?? "—"} · ${kimlik.brans ?? "—"}`;
    }
    if (senaryo === "ogrenci") {
      return [kimlik.sinif, okul].filter(Boolean).join(" · ") || "Öğrenci";
    }
    return [kimlik.brans, okul].filter(Boolean).join(" · ") || "Öğretmen";
  }

  const gruplar = new Map<SenaryoKodu, AuthKimlik[]>();
  for (const kimlik of kimlikler) {
    const senaryo = senaryoBelirle(kimlik);
    gruplar.set(senaryo, [...(gruplar.get(senaryo) ?? []), kimlik]);
  }

  /*
   * Arama, ad-soyadın yanında il ve okul adında da eşleşir: envanter büyüdükçe
   * "Van'daki koordinatörle gireyim" en sık ihtiyaç oluyor. Eşleşme kimlik
   * kartında GÖRÜNEN alanlar üzerinden yapılır, gizli veri üzerinden değil.
   */
  function aramayaUyuyorMu(kimlik: AuthKimlik, senaryo: SenaryoKodu): boolean {
    if (!aranan) return true;
    const il = ILLER.find((i) => i.ilKodu === kimlik.ilKodu)?.ad ?? "";
    const alanlar = [
      `${kimlik.ad} ${kimlik.soyad}`,
      il,
      kimlik.ilKodu ?? "",
      kimlik.kurumKodu ? (kurumAdlari.get(kimlik.kurumKodu) ?? "") : "",
      altBilgi(kimlik, senaryo),
    ];
    return alanlar.some((alan) =>
      alan.toLocaleLowerCase("tr").includes(aranan),
    );
  }

  const eslesenToplam = [...gruplar.entries()].reduce(
    (toplam, [senaryo, grup]) =>
      toplam + grup.filter((k) => aramayaUyuyorMu(k, senaryo)).length,
    0,
  );

  return (
    <div className="min-h-screen">
      <div className="bg-serit text-serit-metin">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <p className="text-[11px] font-semibold tracking-widest uppercase">
            MEB · YEĞİTEK
          </p>
          <TemaSecici aktif={tema} />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-vurgu-metin"
        >
          <ChevronLeft size={15} aria-hidden />
          Açılış ekranı
        </Link>

        <header className="mt-4 border-b border-cizgi pb-6">
          <h1 className="text-3xl font-bold text-baslik">
            GençTek Bilgi Sistemi
          </h1>
          <p className="mt-2 text-metin-yumusak">
            Öğrenci ve danışman öğretmen envanteri, çalışma grupları ve etkinlik
            başvuru sistemi.
          </p>
        </header>

        {ortam.AUTH_PROVIDER === "mock" && (
          <div className="mt-6 flex gap-3 rounded-kart border border-uyari-cizgi bg-uyari-zemin px-4 py-3 text-sm text-uyari-metin">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p>
              <strong className="font-semibold">Geliştirme kipi.</strong> EBA SSO
              erişimi henüz sağlanmadığı için giriş, aşağıdaki senaryolardan biri
              seçilerek yapılır. Yetki ve kapsam kuralları gerçek kurallarla
              çalışır: her senaryo yalnızca kendi kapsamındaki veriyi görür.
            </p>
          </div>
        )}

        {hata && (
          <div className="mt-6 rounded-kart border border-hata-cizgi bg-hata-zemin px-4 py-3 text-sm text-hata-metin">
            {hata}
          </div>
        )}

        {kimlikler.length === 0 && (
          <div className="mt-8 rounded-kart border border-cizgi bg-kart px-4 py-6 text-metin-yumusak">
            Seçilebilecek kimlik yok. EBA sağlayıcısı etkinse giriş SSO üzerinden
            yapılır.
          </div>
        )}

        <form method="get" className="mt-8 flex flex-wrap items-end gap-3">
          <label className="block flex-1">
            <span className="text-sm font-medium text-metin-yumusak">
              Kimlik ara
            </span>
            <input
              type="search"
              name="ara"
              defaultValue={ara ?? ""}
              placeholder="Ad, il veya okul"
              className="mt-1 w-full rounded-md border border-cizgi bg-kart px-3 py-2 text-sm text-metin outline-none focus:border-vurgu"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-birincil px-4 py-2 text-sm font-semibold text-birincil-metin transition hover:bg-birincil-koyu"
          >
            <Search size={15} aria-hidden />
            Ara
          </button>
          {aranan && (
            <Link
              href="/giris"
              className="inline-flex items-center gap-1 text-sm font-medium text-vurgu-metin"
            >
              Aramayı temizle
            </Link>
          )}
        </form>

        <p className="mt-3 text-sm text-metin-yumusak">
          {aranan
            ? `"${ara}" için ${eslesenToplam} kimlik eşleşti (toplam ${kimlikler.length}).`
            : `Sistemde ${kimlikler.length} kimlik var.`}
        </p>

        {aranan && eslesenToplam === 0 && (
          <div className="mt-6 rounded-kart border border-cizgi bg-kart px-4 py-6 text-metin-yumusak">
            Aramanızla eşleşen kimlik yok.
          </div>
        )}

        <div className="mt-8 space-y-8">
          {SENARYO_TANIMLARI.map((senaryo) => {
            const grup = (gruplar.get(senaryo.kod) ?? []).filter((kimlik) =>
              aramayaUyuyorMu(kimlik, senaryo.kod),
            );
            if (grup.length === 0) return null;

            // Uzun listeler kırpılır ama kırpma bir çıkmaz değil: kaç kişinin
            // gizlendiği yazılıyor ve grubun tamamı tek tıkla açılıyor.
            const acik = tumu === senaryo.kod;
            const gosterilecek = acik ? grup : grup.slice(0, GOSTERIM_SINIRI);
            const gizlenen = grup.length - gosterilecek.length;
            const grupYolu = (acilacak: string | null) => {
              const sorgu = new URLSearchParams();
              if (ara) sorgu.set("ara", ara);
              if (acilacak) sorgu.set("tumu", acilacak);
              // Arama ve "tümünü göster" gezinmesi dönüş yolunu düşürmemeli:
              // portaldan gelen kişi kimliğini ararken hedefini kaybederdi.
              if (nereye) sorgu.set("nereye", nereye);
              const metin = sorgu.toString();
              return `${metin ? `/giris?${metin}` : "/giris"}#${senaryo.kod}`;
            };

            return (
              <section key={senaryo.kod} id={senaryo.kod}>
                <h2 className="flex flex-wrap items-center gap-2 font-semibold text-baslik">
                  <senaryo.Ikon size={17} className="text-vurgu-metin" />
                  {senaryo.baslik}
                  <span className="rounded-full bg-vurgu-zemin px-2 py-0.5 text-xs font-medium text-vurgu-metin">
                    {grup.length}
                  </span>
                </h2>
                <p className="mt-1 mb-3 text-sm text-metin-yumusak">
                  {senaryo.aciklama}
                </p>
                <div className="space-y-2">
                  {gosterilecek.map((kimlik) => (
                    <KimlikKarti
                      key={kimlik.authProviderId}
                      kimlik={kimlik}
                      altBilgi={altBilgi(kimlik, senaryo.kod)}
                      seritSinifi={senaryo.seritSinifi}
                      nereye={nereye}
                    />
                  ))}
                </div>
                {gizlenen > 0 && (
                  <p className="mt-2 text-sm text-metin-yumusak">
                    … ve {gizlenen} kişi daha.{" "}
                    <Link
                      href={grupYolu(senaryo.kod)}
                      className="font-medium text-vurgu-metin underline underline-offset-2"
                    >
                      Tümünü göster
                    </Link>{" "}
                    veya aramayla daraltın.
                  </p>
                )}
                {acik && grup.length > GOSTERIM_SINIRI && (
                  <p className="mt-2 text-sm text-metin-yumusak">
                    Grubun tamamı ({grup.length} kişi) açık.{" "}
                    <Link
                      href={grupYolu(null)}
                      className="font-medium text-vurgu-metin underline underline-offset-2"
                    >
                      Kısalt
                    </Link>
                  </p>
                )}
              </section>
            );
          })}
        </div>

        {/*
          EBA dışı giriş buradan DEĞİL ayrı bir ekrandan yapılır: bu sayfa
          kimlik seçtirir, orası e-posta ve şifre sorar. İki akışı tek ekranda
          birleştirmek, EBA entegrasyonu geldiğinde sökülmesi gereken bir
          karmaşa bırakırdı (bkz. app/dis-giris/page.tsx).
        */}
        <div className="mt-10 border-t border-cizgi pt-6 text-sm text-metin-yumusak">
          EBA hesabı olmayan mezun ve paydaş temsilcileri{" "}
          <Link href="/dis-giris" className="font-medium text-vurgu-metin">
            mezun ve paydaş girişini
          </Link>{" "}
          kullanır; hesabı olmayanlar{" "}
          <Link href="/basvuru" className="font-medium text-vurgu-metin">
            başvuru yapar
          </Link>
          .
        </div>
      </main>
    </div>
  );
}

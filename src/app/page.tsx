import { Info, LogIn, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TemaSecici } from "@/components/TemaSecici";
import { oturumKullanicisi } from "@/lib/auth/oturum";
import { ortam, uygulamaYolu } from "@/lib/ortam";
import { aktifTema } from "@/lib/tema";

/**
 * Açılış ekranı — sistemin kapısı.
 *
 * İKİ GİRİŞ YOLU VARDIR ve ikisi eşit değildir:
 *   1. EBA ile giriş — öğrenci ve öğretmenlerin TEK yolu. Kimlik EBA'dan
 *      gelir, şifre diye bir kavram yoktur ve olmayacaktır.
 *   2. E-Devlet ile Giriş (mezun, paydaş, mentör) — EBA hesabı olmayanlar için,
 *      bugün e-posta ve
 *      şifreyle. Kendiliğinden kayıt DEĞİLDİR: başvuru proje yöneticisinin
 *      onayından geçmeden hesap açılmaz.
 *
 * İkincisi ekranda bilinçli olarak ikincil ağırlıkta duruyor: kullanıcıların
 * ezici çoğunluğu birinci yoldan girer ve iki eşit düğme, öğrenciyi yanlış
 * kapıya yönlendirirdi.
 *
 * EBA SSO erişimi henüz sağlanmadığı için birinci düğme şimdilik geliştirme
 * senaryolarının bulunduğu /giris ekranına götürür. Erişim geldiğinde burada
 * değişecek tek şey düğmenin hedefidir — ekranın kendisi aynı kalır.
 */

export const dynamic = "force-dynamic";

export default async function AcilisSayfasi() {
  const [kullanici, tema] = await Promise.all([
    oturumKullanicisi(),
    aktifTema(),
  ]);

  // Oturumu açık olan kapıda bekletilmez.
  if (kullanici) {
    /*
     * Oturumu açık kullanıcı kapıda bekletilmez. Hedef PROFİLDİR, panel değil
     * (7 Ağustos 2026 · istek: "tüm kullanıcı grupları için ilk açılınca
     * profil sekmesi ile başlasın"); giriş eylemiyle aynı yere düşmeli, yoksa
     * aynı kişi nereden geldiğine göre farklı ekran görürdü.
     */
    redirect("/panel");
  }

  const mockMu = ortam.AUTH_PROVIDER === "mock";
  // Kayıt kipi (17 Eylül 2026): EBA SSO yok, kişi kendi kaydını açıyor.
  const kayitMi = ortam.AUTH_PROVIDER === "kayit";

  return (
    <div className="vitrin flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <p className="text-[11px] font-semibold tracking-widest text-vitrin-metin-yumusak uppercase">
          T.C. Millî Eğitim Bakanlığı · YEĞİTEK
        </p>
        <TemaSecici aktif={tema} />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          {/*
            Logo BEYAZ bir kutunun içinde: açılış ekranının zemini kurumsal
            kırmızı ve logonun kendisi de kırmızı — doğrudan konsaydı zeminde
            kaybolurdu.

            next/image KULLANILMIYOR: dosya public dizininde ve boyutu sabit;
            optimizasyon katmanı burada bir şey kazandırmıyor. Yol
            uygulamaYolu()'ndan geçiyor çünkü uygulama alt dizine kurulu
            (/genctek) ve ham src öneki kendiliğinden almaz.
          */}
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-kart bg-white p-3 shadow-yuksek">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uygulamaYolu("/genc.png")}
              alt="GençTek"
              className="h-full w-full object-contain"
            />
          </div>

          <h1 className="mb-2 text-4xl font-extrabold text-vitrin-metin">
            GençTek
          </h1>
          <p className="mb-9 text-vitrin-metin-yumusak">
            Genç Bilişim Ekosistemi
          </p>

          <Link
            href="/giris"
            className="flex w-full items-center justify-center gap-2 rounded-kutu bg-vitrin-secili-zemin py-3.5 font-semibold text-vitrin-secili-metin shadow-yuksek transition hover:opacity-90"
          >
            <LogIn size={16} aria-hidden />
            {kayitMi ? "Öğrenci / Öğretmen Girişi" : "EBA ile Giriş Yap"}
          </Link>

          <p className="mt-4 text-xs text-vitrin-metin-yumusak">
            {kayitMi ? (
              <>
                T.C. kimlik numaranız ve şifrenizle girersiniz. Hesabınız
                yoksa{" "}
                <Link href="/kayit" className="font-semibold underline">
                  kayıt olun
                </Link>
                .
              </>
            ) : (
              "Öğrenci ve öğretmen kimlik bilgileri EBA üzerinden alınır."
            )}
          </p>

          {/*
            "E-DEVLET İLE GİRİŞ" (7 Ağustos 2026 · istek).
            Düğmenin adı e-Devlet, gittiği yer bugün e-posta/şifre ekranı.

            GERÇEK E-DEVLET ENTEGRASYONU HENÜZ YOK ve yazılamaz: e-Devlet
            Kapısı kurum başvurusu, test ortamı erişimi ve istemci sertifikası
            gerektiriyor — hiçbiri elimizde değil. EBA SSO da aynı sebeple
            bekliyor (SKILL.md · adım 13).

            Düğmenin adının şimdiden e-Devlet olması BİLİNÇLİ: kullanıcıya
            gösterilecek kapı bu ve entegrasyon geldiğinde değişecek tek yer
            `AuthProvider` uygulaması olacak — bu ekran değil.
          */}
          <div className="mt-7 border-t border-vitrin-cizgi/60 pt-7">
            <Link
              href="/dis-giris"
              className="flex w-full items-center justify-center gap-2 rounded-kutu border border-vitrin-cizgi bg-white/10 py-3 text-sm font-semibold text-vitrin-metin transition hover:bg-white/20"
            >
              <Users size={16} aria-hidden />
              E-Devlet ile Giriş
            </Link>
            <p className="mt-2.5 text-xs text-vitrin-metin-yumusak">
              Mezun öğrenci/Paydaş/Mentör girişleri için tıklayınız.
            </p>
            {/*
              BAŞVURU SATIRI KALKTI (10 Ağustos 2026 · istek). Açılış ekranı
              artık yalnızca iki kapı gösteriyor; "hesabınız yoksa başvurun"
              açıklaması kapının önünde değil, ARKASINDA duruyor.

              AKIŞ SİLİNMEDİ: /basvuru sayfası ve onay süreci yerinde,
              girişin altındaki "Hesabım yok, başvuru yapmak istiyorum"
              bağlantısıyla ulaşılıyor (bkz. app/dis-giris/page.tsx). Adres
              doğrudan da açılıyor — gönderilmiş bağlantılar kırılmadı.
            */}
          </div>

          {mockMu && (
            <div className="mt-10 rounded-kutu border border-vitrin-cizgi bg-white/10 p-4 text-left">
              <p className="text-xs text-vitrin-metin-yumusak">
                <Info size={12} className="mr-1 mb-0.5 inline" aria-hidden />
                EBA SSO erişimi henüz sağlanmadı. Bu düğme sizi geliştirme
                senaryolarının bulunduğu giriş ekranına götürür; yetki ve kapsam
                kuralları orada da gerçek kurallarla çalışır.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-vitrin-metin-yumusak">
        T.C. Millî Eğitim Bakanlığı · Yenilik ve Eğitim Teknolojileri Genel
        Müdürlüğü
      </footer>
    </div>
  );
}

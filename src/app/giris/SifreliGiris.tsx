import { CheckCircle2, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { KamuSayfaDuzeni } from "@/components/KamuSayfaDuzeni";
import {
  BilgiKutusu,
  Kart,
  SINIF_BIRINCIL_BUTON,
  SINIF_GIRDI,
} from "@/components/ui";
import { sifreliGirisEylemi } from "./eylemler";

/**
 * T.C. kimlik no + şifreyle giriş ekranı (17 Eylül 2026 · AUTH_PROVIDER="kayit").
 *
 * İsim seçerek giriş listesinin yerine geçer. EBA SSO bağlandığında bu ekran
 * SSO yönlendirmesine bırakılır.
 */
export function SifreliGiris({
  hata,
  kayitTamam,
  nereye,
}: {
  hata?: string;
  kayitTamam: boolean;
  nereye: string | null;
}) {
  return (
    <KamuSayfaDuzeni
      baslik="GençTek Bilgi Sistemi"
      aciklama="Öğrenci ve öğretmen girişi"
      genislik="max-w-md"
    >
      {kayitTamam && (
        <BilgiKutusu cesit="olumlu" className="mt-6">
          <p className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Kaydınız oluşturuldu. T.C. kimlik numaranız ve şifrenizle giriş
              yapabilirsiniz.
            </span>
          </p>
        </BilgiKutusu>
      )}

      {hata && (
        <BilgiKutusu cesit="hata" className="mt-6">
          {hata}
        </BilgiKutusu>
      )}

      <Kart className="mt-6">
        <form action={sifreliGirisEylemi} className="space-y-4">
          {nereye && <input type="hidden" name="nereye" value={nereye} />}
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">
              T.C. kimlik numarası
            </span>
            {/* Desen yok: yönetici kullanıcı adıyla da buradan girer. */}
            <input
              name="tcKimlikNo"
              required
              maxLength={32}
              autoCapitalize="none"
              autoComplete="username"
              className={SINIF_GIRDI}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-metin-yumusak">Şifre</span>
            <input
              type="password"
              name="sifre"
              required
              maxLength={200}
              autoComplete="current-password"
              className={SINIF_GIRDI}
            />
          </label>
          <button type="submit" className={`${SINIF_BIRINCIL_BUTON} w-full justify-center`}>
            <LogIn size={16} aria-hidden />
            Giriş yap
          </button>
        </form>
      </Kart>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-cizgi pt-6 text-sm text-metin-yumusak">
        <span>Hesabınız yok mu?</span>
        <Link
          href="/kayit"
          className="inline-flex items-center gap-1.5 font-medium text-vurgu-metin"
        >
          <UserPlus size={15} aria-hidden />
          Kayıt olun
        </Link>
      </div>

      <p className="mt-4 text-sm text-metin-yumusak">
        Şifrenizi unuttuysanız proje yöneticisine başvurun.
      </p>
    </KamuSayfaDuzeni>
  );
}

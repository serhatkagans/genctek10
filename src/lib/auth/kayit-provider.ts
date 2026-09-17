import { prisma } from "../db";
import { KIMLIK_ALANLARI, satiriKimligeCevir } from "./mock-provider";
import type { AuthKimlik, AuthProvider } from "./tipler";

/**
 * Kayıtla giriş sağlayıcısı — EBA SSO gelene kadar (17 Eylül 2026).
 *
 * Kimliğin kaynağı kişinin KENDİ doldurduğu kayıt formudur; form
 * `kullanici` satırını açar (bkz. lib/kayit/kayit.ts). Sağlayıcı bu yüzden
 * kimliği veritabanından okur ve `kimlikGetir` gecelik senkronda hiçbir şeyi
 * değiştirmez: satır zaten kendisiyle aynıdır.
 *
 * ŞİFRE BURADA DOĞRULANMAZ. `girisYap` arayüzü tek bir metin alıyor ve o metin
 * T.C. kimlik numarasıdır; şifre kontrolü ÖNCE lib/kayit/giris.ts'te yapılır,
 * akışa ancak doğrulanan kişi girer. Kimlik seçerek giriş eylemi
 * (app/giris/eylemler.ts · girisEylemi) bu kipte REDDEDİLİR — yoksa T.C.
 * numarasını gönderen herkes şifresiz girerdi.
 *
 * Kaydı olup şifresi olmayan satır (ör. eski mock kayıtları) kimlik
 * sayılmaz: bu kipte giriş yolu yalnızca kayıt formundan geçer.
 */
export class KayitAuthProvider implements AuthProvider {
  readonly saglayiciAdi = "kayıt";

  async girisYap(kimlikBilgisi: string): Promise<AuthKimlik | null> {
    return this.kimlikGetir(kimlikBilgisi);
  }

  async kimlikGetir(authProviderId: string): Promise<AuthKimlik | null> {
    const satir = await prisma.kullanici.findFirst({
      where: { authProviderId, kayitKimlik: { isNot: null } },
      select: KIMLIK_ALANLARI,
    });
    return satir ? satiriKimligeCevir(satir) : null;
  }

  /** Kullanıcı listesi gösterilmez; giriş T.C. kimlik no + şifreyle. */
  async secilebilirKimlikler(): Promise<AuthKimlik[]> {
    return [];
  }
}

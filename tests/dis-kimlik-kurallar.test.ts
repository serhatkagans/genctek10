import {
  BASARISIZ_DENEME_SINIRI,
  basarisizDenemeSonucu,
  type DisBasvuruGirdisi,
  disBasvuruGirdisiniCoz,
  epostaGecerliMi,
  epostaNormalle,
  KILIT_SURESI_DAKIKA,
  kimlikSecerekGirisAcikMi,
  kilitKalanDakika,
  kilitliMi,
  retGerekcesiniCoz,
  SIFIRLAMA_BEKLEME_DAKIKA,
  SIFIRLAMA_GECERLILIK_DAKIKA,
  sifirlamaGecerliMi,
  sifirlamaYenidenIstenebilirMi,
  sifreKarariniVer,
  turunRolu,
} from "@/lib/dis-kimlik/kurallar";

/**
 * EBA dışı giriş kuralları.
 *
 * Sınanan şey ekran değil KARARDIR: hangi başvuru kabul edilir, hangi şifre
 * yeterlidir, kaç hatalı denemeden sonra kilit gelir. Bu kararların hepsi saf
 * fonksiyonlarda tutuluyor (lib/dis-kimlik/kurallar.ts).
 */

const SIMDI = new Date("2026-08-05T12:00:00+03:00");

function girdiYap(
  ozellikler: Partial<DisBasvuruGirdisi> = {},
): DisBasvuruGirdisi {
  return {
    tur: "MEZUN",
    ad: "Deniz",
    soyad: "Yıldırım",
    eposta: "deniz.yildirim@ornek.com",
    telefon: "0555 111 22 33",
    ilKodu: "34",
    sifre: "kavun-portakal-7",
    sifreTekrar: "kavun-portakal-7",
    mezunKurumKodu: "",
    mezuniyetYili: "2024",
    paydasId: "",
    gorevUnvani: "",
    beyan:
      "Yazılım alanında akran eğitimi vermek ve mezun olduğum okulun öğrencilerine mentorluk yapmak istiyorum.",
    mentorlukIstiyor: false,
    mentorlukKonulari: "",
    mentorlukGrupIdleri: [],
    ...ozellikler,
  };
}

/*
 * MENTÖRLÜK (7 Ağustos 2026).
 *
 * İstek: "Paydaş/Mentör başvurusu tek bir formdan yapılacak."
 * Aynı form üç sıfata da hizmet ediyor; mentörlük mezun ve paydaş tarafından
 * da işaretlenebiliyor.
 */
describe("başvuruda mentörlük", () => {
  test("MENTOR türünde işaret zorunlu olarak açılır", () => {
    // Kutu gelmese de: o türü seçen kişi zaten mentörlük istiyor.
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({
        tur: "MENTOR",
        mentorlukIstiyor: false,
        mentorlukKonulari: "Arduino",
      }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (karar.olurMu) expect(karar.kayit.mentorlukIstiyor).toBe(true);
  });

  test("mezun da ayrıca mentörlük isteyebilir", () => {
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ mentorlukIstiyor: true, mentorlukGrupIdleri: ["3"] }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (karar.olurMu) {
      expect(karar.kayit.tur).toBe("MEZUN");
      expect(karar.kayit.mentorlukGrupIdleri).toEqual([3]);
    }
  });

  test("mentörlük isteniyorsa grup ya da konu şart", () => {
    /*
     * İkisi de boşsa öğrenci bu kişiye hangi konuda başvuracağını bilemez;
     * kayıt panoda görünür ama hiçbir ilana eşleşmez.
     */
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ tur: "MENTOR", mentorlukKonulari: "  " }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(false);
  });

  test("mentörlük istenmiyorsa alanlar sessizce düşürülür", () => {
    // Kutu işaretlenmeden gönderilen konular, istek dışı bir mentörlük
    // kaydı doğurmamalı.
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({
        mentorlukIstiyor: false,
        mentorlukKonulari: "Arduino",
        mentorlukGrupIdleri: ["3"],
      }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (karar.olurMu) {
      expect(karar.kayit.mentorlukKonulari).toBeNull();
      expect(karar.kayit.mentorlukGrupIdleri).toEqual([]);
    }
  });

  test("tekrarlanan grup kimliğini teke indirir", () => {
    // Junction tablonun birincil anahtarı çakışırdı.
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({
        tur: "MENTOR",
        mentorlukGrupIdleri: ["2", "2", "5"],
      }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (karar.olurMu) expect(karar.kayit.mentorlukGrupIdleri).toEqual([2, 5]);
  });

  test("MENTOR türünde paydaş kurumu sorulmaz", () => {
    // Mentörün bağı bir kurum üzerinden değil, konular üzerinden kurulur.
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ tur: "MENTOR", paydasId: "", mentorlukKonulari: "Robotik" }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (karar.olurMu) expect(karar.kayit.paydasId).toBeNull();
  });
});

describe("e-posta normalleştirme", () => {
  test("büyük/küçük harf farkı iki ayrı hesap doğurmaz", () => {
    expect(epostaNormalle("  Ali.Veli@Ornek.COM ")).toBe("ali.veli@ornek.com");
  });

  test("Türkçe küçültme kuralı UYGULANMAZ — 'I' harfi 'ı'ya dönmez", () => {
    // toLocaleLowerCase("tr") kullanılsaydı "ALI@x.com" → "alı@x.com" olur ve
    // kişi kendi adresiyle giriş yapamazdı.
    expect(epostaNormalle("ALI@ornek.com")).toBe("ali@ornek.com");
  });

  test("biçimi bozuk adres elenir", () => {
    expect(epostaGecerliMi("ali@ornek.com")).toBe(true);
    expect(epostaGecerliMi("ali(at)ornek.com")).toBe(false);
    expect(epostaGecerliMi("ali@ornek")).toBe(false);
  });
});

describe("şifre kuralı", () => {
  const baglam = {
    ad: "Deniz",
    soyad: "Yıldırım",
    eposta: "deniz.yildirim@ornek.com",
  };

  test("uzunluk alt sınırının altındaki şifre reddedilir", () => {
    expect(sifreKarariniVer("kısa123", baglam).olurMu).toBe(false);
  });

  test("tek karakterden ibaret uzun şifre reddedilir", () => {
    expect(sifreKarariniVer("aaaaaaaaaaaa", baglam).olurMu).toBe(false);
  });

  test("kişinin adını içeren şifre reddedilir", () => {
    expect(sifreKarariniVer("deniz-guclu-sifre", baglam).olurMu).toBe(false);
  });

  test("e-postanın kullanıcı adını içeren şifre reddedilir", () => {
    const karar = sifreKarariniVer("xx-deniz.yildirim-xx", baglam);
    expect(karar.olurMu).toBe(false);
  });

  test("uzun ve kişiyle ilgisiz şifre kabul edilir", () => {
    expect(sifreKarariniVer("kavun-portakal-7", baglam).olurMu).toBe(true);
  });
});

describe("kaba kuvvet koruması", () => {
  test("sınırın altındaki hatalı denemeler kilitlemez", () => {
    const sonuc = basarisizDenemeSonucu(
      { basarisizDeneme: 0, kilitBitisTarihi: null },
      SIMDI,
    );
    expect(sonuc.basarisizDeneme).toBe(1);
    expect(sonuc.kilitBitisTarihi).toBeNull();
  });

  test("sınıra ulaşan deneme kilitler ve sayacı sıfırlar", () => {
    const sonuc = basarisizDenemeSonucu(
      { basarisizDeneme: BASARISIZ_DENEME_SINIRI - 1, kilitBitisTarihi: null },
      SIMDI,
    );
    expect(sonuc.kilitBitisTarihi).not.toBeNull();
    // Sayaç sıfırlanır: kilidi biten kişi tek hatalı denemeyle yeniden
    // kilitlenmemeli, ona da tam bir hak seti verilir.
    expect(sonuc.basarisizDeneme).toBe(0);
    expect((sonuc.kilitBitisTarihi as Date).getTime()).toBe(
      SIMDI.getTime() + KILIT_SURESI_DAKIKA * 60000,
    );
  });

  test("kilit SÜRELİDİR; süresi geçmiş kilit engel değildir", () => {
    const gecmis = new Date(SIMDI.getTime() - 60000);
    expect(
      kilitliMi({ basarisizDeneme: 0, kilitBitisTarihi: gecmis }, SIMDI),
    ).toBe(false);
  });

  test("kalan süre yukarı yuvarlanır, en az 1 dakika görünür", () => {
    const birazSonra = new Date(SIMDI.getTime() + 10_000);
    expect(
      kilitKalanDakika(
        { basarisizDeneme: 0, kilitBitisTarihi: birazSonra },
        SIMDI,
      ),
    ).toBe(1);
  });
});

describe("sıfırlama jetonu geçerliliği", () => {
  test("süresi dolmuş jeton geçersizdir", () => {
    expect(sifirlamaGecerliMi(new Date(SIMDI.getTime() - 1), SIMDI)).toBe(false);
  });

  test("jetonu hiç olmayan kayıt geçersizdir", () => {
    expect(sifirlamaGecerliMi(null, SIMDI)).toBe(false);
  });

  test("süresi geçmemiş jeton geçerlidir", () => {
    expect(sifirlamaGecerliMi(new Date(SIMDI.getTime() + 60_000), SIMDI)).toBe(
      true,
    );
  });
});

describe("sıfırlama isteğinde bekleme süresi", () => {
  /** `dakikaOnce` dakika önce verilmiş bir jetonun son geçerlilik tarihi. */
  function verilmis(dakikaOnce: number): Date {
    const kalan = SIFIRLAMA_GECERLILIK_DAKIKA - dakikaOnce;
    return new Date(SIMDI.getTime() + kalan * 60_000);
  }

  test("hiç jetonu olmayan kayıt beklemez", () => {
    expect(sifirlamaYenidenIstenebilirMi(null, SIMDI)).toBe(true);
  });

  test("az önce verilmiş bağlantı yenisini engeller", () => {
    expect(sifirlamaYenidenIstenebilirMi(verilmis(0), SIMDI)).toBe(false);
  });

  test("bekleme süresi dolunca yeniden istenebilir", () => {
    expect(
      sifirlamaYenidenIstenebilirMi(verilmis(SIFIRLAMA_BEKLEME_DAKIKA), SIMDI),
    ).toBe(true);
  });

  // Bağlantısı elinde ama süresi geçmiş kişi kapıda kalmamalı: geçersiz jeton
  // beklemeyi de sıfırlar.
  test("süresi dolmuş jeton beklemeye yol açmaz", () => {
    expect(
      sifirlamaYenidenIstenebilirMi(new Date(SIMDI.getTime() - 1), SIMDI),
    ).toBe(true);
  });
});

describe("başvuru türü ile rol eşlemesi", () => {
  test("mezun ve paydaş ayrı rollere düşer", () => {
    expect(turunRolu("MEZUN")).toBe("MEZUN");
    expect(turunRolu("PAYDAS")).toBe("PAYDAS_TEMSILCISI");
  });
});

/**
 * Şifresiz giriş kapısı.
 *
 * Kapı geliştirme kolaylığı için var (e-Devlet entegrasyonu yok) ama üretimde
 * açık kalırsa sistemin tamamı açılır: kimlik seçmek şifre bilmeye eşit hâle
 * gelir. Ölçüt bu yüzden tek bir saf fonksiyonda tutuluyor ve burada
 * sınanıyor.
 */
describe("kimlik seçerek giriş kapısı", () => {
  test("mock sağlayıcıda açıktır", () => {
    expect(kimlikSecerekGirisAcikMi("mock")).toBe(true);
  });

  test("eba sağlayıcısında kapalıdır", () => {
    expect(kimlikSecerekGirisAcikMi("eba")).toBe(false);
  });

  test("kayıtla giriş kipinde kapalıdır", () => {
    expect(kimlikSecerekGirisAcikMi("kayit")).toBe(false);
  });
});

describe("başvuru girdisi", () => {
  test("geçerli mezun başvurusu kabul edilir", () => {
    const karar = disBasvuruGirdisiniCoz(girdiYap(), SIMDI);
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.tur).toBe("MEZUN");
    expect(karar.kayit.mezuniyetYili).toBe(2024);
    // Okul isteğe bağlı: kapanmış ya da listede olmayan okuldan mezun olan
    // kişi başvuramaz hâle gelmemeli.
    expect(karar.kayit.mezunKurumKodu).toBeNull();
  });

  test("e-posta normalleştirilerek kaydedilir", () => {
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ eposta: "  Deniz.Yildirim@Ornek.Com " }),
      SIMDI,
    );
    expect(karar.olurMu && karar.kayit.eposta).toBe("deniz.yildirim@ornek.com");
  });

  /*
   * "Aydınlatma metni onaylanmadan başvuru alınmaz" TESTİ KALKTI
   * (21 Ağustos 2026 · istek: "kvkk olmayacak yani sadece çerez politikası").
   * Kutu formdan, şart da kuraldan kalktı; testi tutmak, artık var olmayan bir
   * davranışı savunmak olurdu.
   */

  test("şifre ile tekrarı tutmuyorsa reddedilir", () => {
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ sifreTekrar: "baska-bir-sifre" }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(false);
  });

  test("gelecek yıla ait mezuniyet yılı reddedilir", () => {
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ mezuniyetYili: String(SIMDI.getFullYear() + 1) }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(false);
  });

  test("boş bırakılmış gerekçe reddedilir", () => {
    const karar = disBasvuruGirdisiniCoz(girdiYap({ beyan: "İlgi" }), SIMDI);
    expect(karar.olurMu).toBe(false);
  });

  test("paydaş başvurusunda kurum seçimi ZORUNLUDUR", () => {
    // Serbest metin kurum adı kabul edilmiyor: aynı üniversite onlarca yazımla
    // girilirse il koordinatörlerinin yönettiği envanter kullanılamaz olur.
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ tur: "PAYDAS", paydasId: "", gorevUnvani: "Proje sorumlusu" }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(false);
  });

  test("paydaş başvurusunda görev/unvan zorunludur", () => {
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({ tur: "PAYDAS", paydasId: "7", gorevUnvani: "  " }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(false);
  });

  test("geçerli paydaş başvurusunda mezun alanları boş kalır", () => {
    const karar = disBasvuruGirdisiniCoz(
      girdiYap({
        tur: "PAYDAS",
        paydasId: "7",
        gorevUnvani: "Proje sorumlusu",
        mezuniyetYili: "",
      }),
      SIMDI,
    );
    expect(karar.olurMu).toBe(true);
    if (!karar.olurMu) return;
    expect(karar.kayit.paydasId).toBe(7);
    expect(karar.kayit.mezunKurumKodu).toBeNull();
    expect(karar.kayit.mezuniyetYili).toBeNull();
  });

  test("tanınmayan tür reddedilir", () => {
    expect(disBasvuruGirdisiniCoz(girdiYap({ tur: "OGRENCI" }), SIMDI).olurMu).toBe(
      false,
    );
  });
});

describe("ret gerekçesi", () => {
  test("gerekçesiz ret kabul edilmez", () => {
    expect(retGerekcesiniCoz("   ").olurMu).toBe(false);
    expect(retGerekcesiniCoz("olmaz").olurMu).toBe(false);
  });

  test("gerekçe kırpılarak kaydedilir", () => {
    const karar = retGerekcesiniCoz("  Kurum kaydınız envanterde yok.  ");
    expect(karar.olurMu && karar.gerekce).toBe("Kurum kaydınız envanterde yok.");
  });
});

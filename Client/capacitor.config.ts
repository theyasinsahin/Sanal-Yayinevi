import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.betik.app',
  appName: 'betik-android',
  webDir: 'build',
  server: {
    // Geliştirme sürecinde backend henüz HTTPS değil (http://10.0.2.2:5000).
    // Capacitor varsayılan olarak uygulamayı https://localhost üzerinden
    // servis ediyor; bu, HTTP backend'e istek atarken "Mixed Content"
    // hatasına yol açıyordu (HTTPS sayfa → HTTP kaynak isteği tarayıcı
    // tarafından engellenir). androidScheme: 'http' ile uygulamanın
    // kendisi de http://localhost üzerinden servis edilir, böylece
    // protokol uyuşmazlığı ortadan kalkar.
    //
    // ÖNEMLİ: Backend'i gerçek bir sunucuya HTTPS ile deploy ettiğinde
    // (Play Store'a göndermeden önce mutlaka yapman gereken bir şey),
    // bu satırı ve aşağıdaki cleartext: true satırını KALDIR — o zaman
    // hem uygulama hem backend https olacağı için ikisine de gerek kalmaz
    // ve uygulaman daha güvenli hale gelir.
    androidScheme: 'http',
    cleartext: true,
  }
};

export default config;
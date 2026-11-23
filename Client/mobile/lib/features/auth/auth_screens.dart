import 'dart:async';

import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/auth/google_sign_in.dart';
import '../../core/network/api_error.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';

// --- Password rules (identical to the server, F-AUTH-07) ---------------------

class PasswordRule {
  const PasswordRule(this.label, this.test);
  final String label;
  final bool Function(String) test;
}

final passwordRules = <PasswordRule>[
  PasswordRule('En az 8 karakter', (p) => p.length >= 8),
  PasswordRule('En az 1 büyük harf', (p) => RegExp(r'[A-Z]').hasMatch(p)),
  PasswordRule('En az 1 küçük harf', (p) => RegExp(r'[a-z]').hasMatch(p)),
  PasswordRule('En az 1 rakam', (p) => RegExp(r'[0-9]').hasMatch(p)),
  PasswordRule('En az 1 özel karakter (!@#\$...)', (p) => RegExp(r'[^A-Za-z0-9]').hasMatch(p)),
];

/// First unmet rule, or null when the password is acceptable. The server
/// additionally limits passwords to 72 UTF-8 bytes.
String? passwordProblem(String password) {
  for (final rule in passwordRules) {
    if (!rule.test(password)) return rule.label;
  }
  if (password.codeUnits.length > 72) return 'Şifre en fazla 72 bayt olabilir.';
  return null;
}

const _strengthLabels = ['', 'Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];
const _strengthColors = [
  Color(0xFFE5E7EB), Color(0xFFEF4444), Color(0xFFF97316), Color(0xFFCA8A04), Color(0xFF16A34A), Color(0xFF15803D), //
];

class PasswordStrengthIndicator extends StatelessWidget {
  const PasswordStrengthIndicator(this.password, {super.key});
  final String password;

  @override
  Widget build(BuildContext context) {
    if (password.isEmpty) return const SizedBox.shrink();
    final passed = passwordRules.where((rule) => rule.test(password)).length;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: passed / passwordRules.length,
                    minHeight: 6,
                    color: _strengthColors[passed],
                    backgroundColor: _strengthColors[0],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                _strengthLabels[passed],
                style: sans(size: 12, weight: FontWeight.w700, color: _strengthColors[passed]),
              ),
            ],
          ),
          const SizedBox(height: 6),
          for (final rule in passwordRules)
            Row(
              children: [
                Icon(
                  rule.test(password) ? Icons.check_circle : Icons.radio_button_unchecked,
                  size: 14,
                  color: rule.test(password) ? const Color(0xFF16A34A) : const Color(0xFFD1D5DB),
                ),
                const SizedBox(width: 6),
                Text(rule.label, style: sans(size: 12, color: rule.test(password) ? BetikColors.graphite : const Color(0xFF9CA3AF))),
              ],
            ),
        ],
      ),
    );
  }
}

// --- Shared frame ----------------------------------------------------------

class _AuthFrame extends StatelessWidget {
  const _AuthFrame({required this.title, required this.children, this.subtitle});
  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('BETİK')),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: PaperCard(
              padding: const EdgeInsets.all(20),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Image.asset('assets/images/app_icon.png', height: 56),
                    const SizedBox(height: 8),
                    Text(
                      title,
                      style: serif(size: 24, weight: FontWeight.w700),
                      textAlign: TextAlign.center,
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        subtitle!,
                        style: serif(size: 14, style: FontStyle.italic, color: BetikColors.ashGray),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    const SizedBox(height: 20),
                    ...children,
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _InlineAlert extends StatelessWidget {
  const _InlineAlert(this.message, {this.success = false});
  final String message;
  final bool success;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: success ? BetikColors.successBg : const Color(0xFFFDF2F2),
      border: Border.all(color: success ? BetikColors.success : BetikColors.danger),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(message, style: sans(size: 13.5, color: success ? BetikColors.success : BetikColors.danger, height: 1.4)),
  );
}

/// Where to land after authentication (web `finishRegistrationIntent`):
/// explicit `returnTo` → pending intent → own profile.
String destinationAfterAuth(BuildContext context, String? returnTo) {
  if (returnTo != null && returnTo.startsWith('/') && !returnTo.startsWith('//')) return returnTo;
  return context.services.intents.returnTo ?? '/profile';
}

// --- Google sign-in --------------------------------------------------------

/// "Google ile devam et" on the login and register screens. Always shown
/// (product requirement on both platforms); the flow lives in
/// `core/auth/google_sign_in.dart`.
class GoogleButton extends StatefulWidget {
  const GoogleButton({super.key, required this.onSignedIn, required this.onError});
  final VoidCallback onSignedIn;
  final ValueChanged<String> onError;
  @override
  State<GoogleButton> createState() => _GoogleButtonState();
}

class _GoogleButtonState extends State<GoogleButton> {
  Future<void> _run() async {
    final services = context.services;
    try {
      final outcome = await signInWithGoogle(services.google, services.auth);
      if (outcome == GoogleSignInOutcome.signedIn && mounted) widget.onSignedIn();
    } on GoogleSignInFailure catch (failure) {
      if (mounted) widget.onError(failure.message);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: BusyButton(outlined: true, icon: Icons.g_mobiledata, label: 'Google ile devam et', onPressed: _run),
  );
}

// --- Login -----------------------------------------------------------------

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.returnTo, this.errorCode});
  final String? returnTo;
  final String? errorCode;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  var _autovalidate = AutovalidateMode.disabled;
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    final auth = context.services.auth;
    _notice = auth.signedOutNotice;
    auth.signedOutNotice = null;
    _error = switch (widget.errorCode) {
      'google_auth_failed' => googleFailedMessage,
      'account_deleted' => 'Bu e-posta adresine ait hesap silinmiş.',
      'google_no_credential' => googleNoCredentialMessage,
      _ => null,
    };
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _finish() {
    if (!mounted) return;
    TextInput.finishAutofillContext();
    context.go(destinationAfterAuth(context, widget.returnTo));
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) {
      // After a failed submit the messages follow the user's corrections.
      setState(() => _autovalidate = AutovalidateMode.onUserInteraction);
      return;
    }
    setState(() => _error = null);
    try {
      await context.services.auth.login(_email.text, _password.text);
      _finish();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error.isNetwork
            ? 'Geçici bir sorun yaşanıyor olabilir. Lütfen biraz sonra tekrar deneyin.'
            : error.kind == ApiErrorKind.rateLimited
            ? error.message
            : 'Giriş yapılamadı. Bilgilerinizi kontrol edin.',
      );
    }
  }

  @override
  Widget build(BuildContext context) => _AuthFrame(
    title: 'Giriş Yap',
    subtitle: 'Kaldığınız yerden devam edin',
    children: [
      if (_notice != null) _InlineAlert(_notice!),
      if (_error != null) _InlineAlert(_error!),
      Form(
        key: _form,
        autovalidateMode: _autovalidate,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LabeledField(
              label: 'E-posta',
              required: true,
              child: TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                autocorrect: false,
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) return 'E-posta zorunludur.';
                  if (!text.contains('@')) return 'Geçerli bir e-posta adresi girin.';
                  return null;
                },
              ),
            ),
            LabeledField(
              label: 'Şifre',
              required: true,
              child: TextFormField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                onFieldSubmitted: (_) => _submit(),
                validator: (value) => (value ?? '').isEmpty ? 'Şifre zorunludur.' : null,
              ),
            ),
            BusyButton(onPressed: _submit, label: 'Giriş Yap'),
          ],
        ),
      ),
      GoogleButton(onSignedIn: _finish, onError: (message) => setState(() => _error = message)),
      const SizedBox(height: 8),
      TextButton(onPressed: () => context.push('/forgot-password'), child: const Text('Şifremi Unuttum')),
      TextButton(
        onPressed: () => context.pushReplacement(
          Uri(path: '/register', queryParameters: widget.returnTo == null ? null : {'returnTo': widget.returnTo}).toString(),
        ),
        child: const Text('Hesabın yok mu? Kayıt Ol'),
      ),
    ],
  );
}

// --- Register (two steps) --------------------------------------------------

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, this.returnTo});
  final String? returnTo;
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  var _autovalidate = AutovalidateMode.disabled;
  final _fullName = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _terms = false;
  bool _showPassword = false;
  int _step = 1;
  String? _error;
  String? _success;
  int _cooldown = 0;
  Timer? _cooldownTimer;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    for (final controller in [_fullName, _username, _email, _password, _code]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _startCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _cooldown = 60);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _cooldown--);
      if (_cooldown <= 0) timer.cancel();
    });
  }

  Future<void> _sendCode() async {
    if (!_form.currentState!.validate()) {
      // After a failed submit the messages follow the user's corrections.
      setState(() => _autovalidate = AutovalidateMode.onUserInteraction);
      return;
    }
    if (!_terms) {
      setState(() => _error = 'Devam etmek için kullanım koşullarını kabul etmelisiniz.');
      return;
    }
    setState(() => _error = null);
    try {
      final status = await context.services.auth.sendRegistrationCode(email: _email.text, username: _username.text);
      if (!mounted) return;
      if (status.ok) {
        setState(() => _step = 2);
        _startCooldown();
      } else {
        // The server reports failures as code 400 with a user-facing message.
        setState(() => _error = status.message.isEmpty ? 'Doğrulama kodu gönderilemedi.' : status.message);
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.isNetwork ? 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.' : error.message);
    }
  }

  Future<void> _complete() async {
    if (!RegExp(r'^[0-9]{6}$').hasMatch(_code.text.trim())) {
      setState(() => _error = 'Doğrulama kodu 6 haneli olmalıdır.');
      return;
    }
    setState(() => _error = null);
    try {
      final status = await context.services.auth.registerAndLogin(
        username: _username.text,
        fullName: _fullName.text,
        email: _email.text,
        password: _password.text,
        code: _code.text,
      );
      if (!mounted) return;
      if (!status.ok) {
        setState(() => _error = status.message.isEmpty ? 'Kayıt tamamlanamadı.' : status.message);
        return;
      }
      setState(() => _success = '${status.message.isEmpty ? 'Kayıt başarılı!' : status.message} Yönlendiriliyorsunuz...');
      TextInput.finishAutofillContext();
      context.go(destinationAfterAuth(context, widget.returnTo));
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.isNetwork ? 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.' : error.message);
    }
  }

  @override
  Widget build(BuildContext context) => _step == 1 ? _buildDetails(context) : _buildCode(context);

  Widget _buildDetails(BuildContext context) => _AuthFrame(
    title: 'Kayıt Ol',
    subtitle: 'Ücretsiz hesabınızı oluşturun',
    children: [
      if (_error != null) _InlineAlert(_error!),
      Form(
        key: _form,
        autovalidateMode: _autovalidate,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LabeledField(
              label: 'Ad Soyad',
              required: true,
              child: TextFormField(
                controller: _fullName,
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.name],
                textInputAction: TextInputAction.next,
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.length < 2) return 'Ad soyad en az 2 karakter olmalıdır.';
                  if (text.length > 120) return 'Ad soyad en fazla 120 karakter olabilir.';
                  return null;
                },
              ),
            ),
            LabeledField(
              label: 'Kullanıcı Adı',
              required: true,
              child: TextFormField(
                controller: _username,
                autocorrect: false,
                autofillHints: const [AutofillHints.newUsername],
                textInputAction: TextInputAction.next,
                validator: (value) => RegExp(r'^[\p{L}\p{N}_][\p{L}\p{N}_.\-]{2,49}$', unicode: true).hasMatch(value?.trim() ?? '')
                    ? null
                    : 'Kullanıcı adı 3–50 karakter olmalı; harf, rakam, alt çizgi, nokta ve tire içerebilir.',
              ),
            ),
            LabeledField(
              label: 'E-posta',
              required: true,
              child: TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                validator: (value) =>
                    RegExp(r'^[^\s@<>,;:"\\]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$').hasMatch(value?.trim() ?? '') &&
                        (value?.trim().length ?? 0) <= 254
                    ? null
                    : 'Geçerli bir e-posta adresi girin.',
              ),
            ),
            LabeledField(
              label: 'Şifre',
              required: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _password,
                    obscureText: !_showPassword,
                    autofillHints: const [AutofillHints.newPassword],
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      suffixIcon: IconButton(
                        tooltip: _showPassword ? 'Şifreyi gizle' : 'Şifreyi göster',
                        icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _showPassword = !_showPassword),
                      ),
                    ),
                    validator: (value) => passwordProblem(value ?? ''),
                  ),
                  PasswordStrengthIndicator(_password.text),
                ],
              ),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(value: _terms, onChanged: (value) => setState(() => _terms = value ?? false)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Wrap(
                      children: [
                        // The web links to /kullanim-kosullari, a route that does
                        // not exist (Stage 1 D-01); the app opens the real page.
                        GestureDetector(
                          onTap: () => context.push('/terms'),
                          child: Text(
                            'Kullanım koşullarını',
                            style: sans(size: 13, weight: FontWeight.w700).copyWith(decoration: TextDecoration.underline),
                          ),
                        ),
                        Text(' okudum ve kabul ediyorum.', style: sans(size: 13)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            BusyButton(onPressed: _sendCode, label: 'Doğrulama Kodu Gönder'),
          ],
        ),
      ),
      GoogleButton(
        onSignedIn: () => context.go(destinationAfterAuth(context, widget.returnTo)),
        onError: (message) => setState(() => _error = message),
      ),
      TextButton(
        onPressed: () => context.pushReplacement(
          Uri(path: '/login', queryParameters: widget.returnTo == null ? null : {'returnTo': widget.returnTo}).toString(),
        ),
        child: const Text('Zaten hesabın var mı? Giriş Yap'),
      ),
    ],
  );

  Widget _buildCode(BuildContext context) => _AuthFrame(
    title: 'E-postanı Doğrula',
    subtitle: '${_email.text.trim()} adresine 6 haneli bir kod gönderdik.',
    children: [
      if (_error != null) _InlineAlert(_error!),
      if (_success != null) _InlineAlert(_success!, success: true),
      LabeledField(
        label: 'Doğrulama Kodu',
        required: true,
        hint: 'Kod 10 dakika geçerlidir.',
        child: TextField(
          controller: _code,
          keyboardType: TextInputType.number,
          maxLength: 6,
          autofillHints: const [AutofillHints.oneTimeCode],
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          textAlign: TextAlign.center,
          style: sans(size: 24, weight: FontWeight.w700, letterSpacing: 8),
          decoration: const InputDecoration(hintText: '000000', counterText: ''),
          onSubmitted: (_) => _complete(),
        ),
      ),
      BusyButton(onPressed: _complete, label: 'Kayıt İşlemini Tamamla'),
      const SizedBox(height: 8),
      BusyButton(
        outlined: true,
        onPressed: _cooldown > 0 ? null : _sendCode,
        label: _cooldown > 0 ? 'Kodu yeniden gönder ($_cooldown)' : 'Kodu yeniden gönder',
      ),
      TextButton(
        onPressed: () => setState(() {
          _step = 1;
          _error = null;
          _code.clear();
        }),
        child: const Text('Bilgileri Düzenle'),
      ),
    ],
  );
}

// --- Forgot / reset password ------------------------------------------------

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_email.text.contains('@')) {
      setState(() => _error = 'Geçerli bir e-posta adresi girin.');
      return;
    }
    setState(() => _error = null);
    try {
      await context.services.auth.forgotPassword(_email.text);
      // The answer is deliberately the same whether or not the account exists.
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (error) {
      if (mounted) {
        setState(
          () => _error = error.kind == ApiErrorKind.rateLimited
              ? error.message
              : 'Bağlantı gönderilemedi. Lütfen biraz sonra tekrar deneyin.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => _AuthFrame(
    title: 'Şifremi Unuttum',
    subtitle: _sent ? null : 'E-posta adresinizi girin, şifre yenileme bağlantısı gönderelim.',
    children: _sent
        ? [
            const _InlineAlert(
              'E-postanızı kontrol edin. Kayıtlı bir hesabınız varsa şifre yenileme bağlantısı gönderildi. Bağlantı 1 saat geçerlidir.',
              success: true,
            ),
            Text(
              'Bağlantı web sitesinde açılır. Uygulamada tamamlamak için e-postadaki bağlantının sonundaki kodu aşağıdaki ekrana yapıştırabilirsiniz.',
              style: sans(size: 12.5, color: BetikColors.ashGray, height: 1.45),
            ),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: () => context.push('/reset-password'), child: const Text('BAĞLANTI KODUNU GİR')),
            TextButton(onPressed: () => setState(() => _sent = false), child: const Text('Yeniden dene')),
            TextButton(onPressed: () => context.go('/login'), child: const Text('Giriş sayfasına dön')),
          ]
        : [
            if (_error != null) _InlineAlert(_error!),
            LabeledField(
              label: 'E-posta',
              required: true,
              child: TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                autofillHints: const [AutofillHints.email],
                onSubmitted: (_) => _submit(),
              ),
            ),
            BusyButton(onPressed: _submit, label: 'Bağlantı Gönder'),
            TextButton(onPressed: () => context.go('/login'), child: const Text('Giriş sayfasına dön')),
          ],
  );
}

/// Extracts the 64-hex reset token from a pasted link or a bare token.
String? extractResetToken(String input) => RegExp(r'([0-9a-fA-F]{64})').firstMatch(input.trim())?.group(1);

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.token});

  /// From the deep link `/reset-password/<token>`; null when the user has to
  /// paste the link from the e-mail.
  final String? token;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  late final _token = TextEditingController(text: widget.token ?? '');
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;
  String? _success;

  @override
  void dispose() {
    _token.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final token = extractResetToken(_token.text);
    final problem = passwordProblem(_password.text);
    if (token == null) return setState(() => _error = 'Geçersiz veya süresi dolmuş bağlantı.');
    if (problem != null) return setState(() => _error = problem);
    if (_password.text != _confirm.text) return setState(() => _error = 'Şifreler eşleşmiyor.');
    setState(() => _error = null);
    try {
      final status = await context.services.auth.resetPassword(token: token, newPassword: _password.text);
      if (!mounted) return;
      if (!status.ok) return setState(() => _error = status.message);
      setState(() => _success = 'Şifreniz güncellendi! Giriş sayfasına yönlendiriliyorsunuz...');
      await Future<void>.delayed(const Duration(seconds: 3));
      if (mounted) context.go('/login');
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) => _AuthFrame(
    title: 'Yeni Şifre Belirle',
    children: [
      if (_error != null) _InlineAlert(_error!),
      if (_success != null) _InlineAlert(_success!, success: true),
      if (widget.token == null)
        LabeledField(
          label: 'E-postadaki bağlantı',
          required: true,
          hint: 'Şifre yenileme e-postasındaki bağlantının tamamını yapıştırın.',
          child: TextField(controller: _token, autocorrect: false, minLines: 1, maxLines: 3),
        ),
      LabeledField(
        label: 'Yeni Şifre',
        required: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _password,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              onChanged: (_) => setState(() {}),
            ),
            PasswordStrengthIndicator(_password.text),
          ],
        ),
      ),
      LabeledField(
        label: 'Yeni Şifre (Tekrar)',
        required: true,
        child: TextField(controller: _confirm, obscureText: true, onSubmitted: (_) => _submit()),
      ),
      BusyButton(onPressed: _success != null ? null : _submit, label: 'Şifreyi Güncelle'),
    ],
  );
}

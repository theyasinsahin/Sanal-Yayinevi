// Verification batch 9 — Google sign-in without OAuth credentials.
//
// What can be proven on a device before real client ids exist:
//  * the button is present on login and register and explains a missing
//    configuration instead of disappearing;
//  * the real backend `googleAuth` path through the app's session code
//    (a token Google never issued is refused, nothing is stored);
//  * the native plugin wiring: with syntactically valid but NON-EXISTENT
//    client ids (negative test only, never a build configuration) the app
//    fails cleanly — on iOS the URL-scheme guard stops it before the
//    GoogleSignIn SDK could crash the app.
// A successful Google sign-in needs real client ids and a Google account;
// see mobile-docs/stage-3/google_sign_in_setup.md.
import 'dart:async';
import 'dart:io';

import 'package:betik/core/auth/google_sign_in.dart';
import 'package:betik/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'support/harness.dart';

/// Not a credential: a well-formed id that no Google project owns, used only
/// to drive the failure paths.
const _nonExistentWeb = '000000000000-betiknegativetestweb.apps.googleusercontent.com';
const _nonExistentIos = '000000000000-betiknegativetestios.apps.googleusercontent.com';

class _Scripted implements GoogleIdTokenSource {
  _Scripted(this.token);
  final String? token;
  int signOuts = 0;
  @override
  bool get isConfigured => true;
  @override
  Future<String?> idToken() async => token;
  @override
  Future<void> signOut() async => signOuts++;
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('google sign-in', (tester) async {
    final h = Harness(tester, binding, 'google');
    await h.start();

    await h.scenario(
      'F-AUTH-03a',
      'Unconfigured build: the Google button is on login and register and explains the missing configuration',
      () async {
        expect(h.services.config.googleSignInConfigured, isFalse, reason: 'this run carries no Google client ids');
        await h.go('/login');
        await h.waitFor(find.text('GOOGLE İLE DEVAM ET'));
        await h.tap(find.text('GOOGLE İLE DEVAM ET'));
        await h.waitFor(find.text(googleNotConfiguredMessage));
        await h.shot('google_login_unconfigured');
        expect(h.services.auth.isSignedIn, isFalse);
        await h.go('/register');
        await h.waitFor(find.text('GOOGLE İLE DEVAM ET'));
        await h.tap(find.text('GOOGLE İLE DEVAM ET'));
        await h.waitFor(find.text(googleNotConfiguredMessage));
        await h.shot('google_register_unconfigured');
      },
    );

    await h.scenario(
      'F-AUTH-03b',
      'Real backend: a token Google never issued is refused with the website message; no session, no user',
      () async {
        await h.ctl('ratereset', {});
        final users = await h.dbCount('users', {});
        final source = _Scripted('not-a-google-id-token');
        Object? failure;
        try {
          await signInWithGoogle(source, h.services.auth);
        } catch (error) {
          failure = error;
        }
        expect(failure, isA<GoogleSignInFailure>().having((f) => f.message, 'message', googleFailedMessage));
        expect(h.services.auth.isSignedIn, isFalse);
        expect(source.signOuts, 1, reason: 'the Google account is forgotten so another can be chosen');
        expect(await h.dbCount('users', {}), users);
      },
    );

    await h.scenario('F-AUTH-03c', 'Cancel at Google: nothing reaches the backend', () async {
      final outcome = await signInWithGoogle(_Scripted(null), h.services.auth);
      expect(outcome, GoogleSignInOutcome.cancelled);
      expect(h.services.auth.isSignedIn, isFalse);
    });

    await h.scenario(
      'F-AUTH-03d',
      'Native plugin with non-existent client ids fails cleanly (iOS: URL-scheme guard, no SDK crash)',
      () async {
        final c = h.services.config;
        final config = AppConfig(
          apiUrl: c.apiUrl,
          wsUrl: c.wsUrl,
          webUrl: c.webUrl,
          cloudinaryCloudName: c.cloudinaryCloudName,
          cloudinaryUploadPreset: c.cloudinaryUploadPreset,
          googleServerClientId: _nonExistentWeb,
          googleIosClientId: _nonExistentIos,
        );
        final source = PluginGoogleIdTokenSource(config);
        expect(source.isConfigured, isTrue);
        Object? outcome;
        try {
          outcome = await source.idToken().timeout(const Duration(seconds: 25));
        } on TimeoutException catch (error) {
          outcome = error;
        } catch (error) {
          outcome = error;
        }
        await h.shot('google_plugin_nonexistent_client');
        h.note('GOOGLE_PLUGIN_OUTCOME ${Platform.operatingSystem}: $outcome');
        if (Platform.isIOS) {
          expect(
            outcome,
            isA<GoogleSignInFailure>().having((f) => f.configuration, 'configuration', isTrue),
            reason: 'the reversed client id is not a registered URL scheme in this build',
          );
        } else {
          // Credential Manager either reports an error or nothing selectable
          // (seen as a cancel); a UI left open counts as a timeout.
          expect(outcome is GoogleSignInFailure || outcome == null || outcome is TimeoutException, isTrue, reason: '$outcome');
          if (outcome is TimeoutException) await h.adbKey(4); // KEYCODE_BACK
        }
        expect(h.services.auth.isSignedIn, isFalse);
      },
    );

    h.finish();
  });
}

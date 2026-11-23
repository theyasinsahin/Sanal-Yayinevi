// Shared harness for the on-device verification suites.
//
// The suites run the real app on a simulator/emulator against a RUNNING,
// DISPOSABLE backend and drive it through its widgets. A small host-side
// control server (sandbox tooling, loopback only) gives the tests what a
// device cannot reach by itself: the local mail sink, read access to the
// disposable database for backend-effect checks, and real device screenshots.
//
// Defines: BETIK_API_URL, BETIK_WEB_URL, BETIK_TEST_PASSWORD, BETIK_TEST_CTL.
import 'dart:convert';
import 'dart:io';

import 'package:betik/app.dart';
import 'package:betik/core/app_services.dart';
import 'package:betik/core/auth/session.dart';
import 'package:betik/core/network/graphql_client.dart';
import 'package:betik/core/widgets/ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';

const seedPassword = String.fromEnvironment('BETIK_TEST_PASSWORD');
const ctlUrl = String.fromEnvironment('BETIK_TEST_CTL', defaultValue: 'http://localhost:5066');

const adminEmail = 'admin@betik-dev.invalid';
const authorEmail = 'author@betik-dev.invalid';
const readerEmail = 'reader@betik-dev.invalid';
const publisherEmail = 'publisher@betik-dev.invalid';

String get platformName => Platform.isIOS ? 'ios' : 'android';

/// Thrown by a scenario that does not apply to the current platform.
class SkipScenario implements Exception {
  SkipScenario(this.reason);
  final String reason;
}

class ScenarioResult {
  ScenarioResult(this.id, this.name, this.ok, [this.detail = '']);
  final String id;
  final String name;
  final bool ok;
  final String detail;
}

class Harness {
  Harness(this.tester, this.binding, this.suite);
  final WidgetTester tester;
  final IntegrationTestWidgetsFlutterBinding binding;
  final String suite;
  late AppServices services;
  final List<ScenarioResult> results = [];
  final List<String> _flutterErrors = [];
  Key _appKey = UniqueKey();

  // --- App lifecycle -------------------------------------------------------

  Future<void> start({SessionStore? sessionStore, LocalStore? localStore}) async {
    await initializeDateFormatting('tr_TR');
    services = await AppServices.create(sessionStore: sessionStore ?? MemorySessionStore(), localStore: localStore ?? MemoryLocalStore());
    final previous = FlutterError.onError;
    FlutterError.onError = (details) {
      _flutterErrors.add(details.exceptionAsString().split('\n').first);
      note(
        'FLUTTER-ERROR ${details.exceptionAsString().split('\n').take(4).join(' / ')} @ ${details.stack.toString().split('\n').where((l) => l.contains('package:betik') || l.contains('flutter_quill')).take(4).join(' | ')}',
      );
      previous?.call(details);
    };
    await tester.pumpWidget(BetikApp(key: _appKey, services: services));
    await settle();
  }

  /// Mounts a new app instance on [next] (a restart with given services).
  Future<void> restartWith(AppServices next) async {
    _appKey = UniqueKey();
    services = next;
    await tester.pumpWidget(BetikApp(key: _appKey, services: services));
    await settle(8);
  }

  /// A second "device": a fresh app instance with its own empty session.
  Future<void> restartFresh() async {
    _appKey = UniqueKey();
    services = await AppServices.create(sessionStore: MemorySessionStore(), localStore: MemoryLocalStore());
    await tester.pumpWidget(BetikApp(key: _appKey, services: services));
    await settle();
  }

  // --- Pumping -------------------------------------------------------------

  Future<void> settle([int frames = 6]) async {
    for (var i = 0; i < frames; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
  }

  Future<void> waitFor(Finder finder, {Duration timeout = const Duration(seconds: 15)}) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 150));
      if (finder.evaluate().isNotEmpty) return;
    }
    throw TestFailure('Timed out waiting for $finder\nVisible: ${visibleTexts()}');
  }

  Future<void> waitGone(Finder finder, {Duration timeout = const Duration(seconds: 10)}) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 150));
      if (finder.evaluate().isEmpty) return;
    }
    throw TestFailure('Still present: $finder');
  }

  Future<T> waitUntil<T>(Future<T?> Function() probe, {Duration timeout = const Duration(seconds: 15), String what = 'condition'}) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      final value = await probe();
      if (value != null && value != false) return value;
      await tester.pump(const Duration(milliseconds: 300));
    }
    throw TestFailure('Timed out waiting for $what');
  }

  /// Texts currently in the tree (diagnostics for failures).
  String visibleTexts([int max = 60]) {
    final texts = <String>[];
    for (final element in find.byType(Text).evaluate()) {
      final widget = element.widget as Text;
      final value = widget.data ?? widget.textSpan?.toPlainText() ?? '';
      if (value.trim().isNotEmpty) texts.add(value.trim().replaceAll('\n', ' '));
      if (texts.length >= max) break;
    }
    return texts.join(' | ');
  }

  bool has(String text) => find.text(text).evaluate().isNotEmpty;
  bool hasContaining(String text) => find.textContaining(text).evaluate().isNotEmpty;

  // --- Navigation ----------------------------------------------------------

  GoRouter get router => GoRouter.of(tester.element(find.byType(Scaffold).first));
  String get location => router.state.uri.toString();

  Future<void> go(String path) async {
    router.go(path);
    await settle(4);
  }

  Future<void> push(String path) async {
    router.push(path);
    await settle(4);
  }

  Future<void> back() async {
    // The platform back affordance of the top route.
    final backButton = find.byTooltip('Geri');
    if (backButton.evaluate().isNotEmpty) {
      await tester.tap(backButton.last);
    } else {
      router.pop();
    }
    await settle(4);
  }

  // --- Interaction ---------------------------------------------------------

  /// Scrolls the page until [finder] is built (lazy lists) or fails.
  Future<void> reveal(Finder finder, {double step = 300, int maxSteps = 40}) async {
    // Down first, then back up (the target may be above the current
    // scroll position of a lazy list).
    for (final direction in const [-1.0, 1.0]) {
      for (var i = 0; i < maxSteps && finder.evaluate().isEmpty; i++) {
        // The innermost/topmost vertical list that can still move (a
        // bottom sheet's list before the page behind it).
        final scrollables = find
            .byWidgetPredicate((w) => w is Scrollable && (w.axisDirection == AxisDirection.down))
            .evaluate()
            .toList()
            .reversed;
        var moved = false;
        for (final element in scrollables) {
          final state = (element as StatefulElement).state as ScrollableState;
          final position = state.position;
          if (direction < 0 ? position.pixels >= position.maxScrollExtent : position.pixels <= position.minScrollExtent) continue;
          final before = position.pixels;
          await tester.drag(find.byElementPredicate((e) => e == element), Offset(0, direction * step), warnIfMissed: false);
          await settle(2);
          if (position.pixels != before) {
            moved = true;
            break;
          }
        }
        if (!moved) break;
      }
    }
    if (finder.evaluate().isEmpty) throw TestFailure('Not found after scrolling: $finder\nVisible: ${visibleTexts()}');
  }

  Future<void> tap(Finder finder, {bool scroll = true}) async {
    if (finder.evaluate().isEmpty && scroll) await reveal(finder);
    if (finder.evaluate().isEmpty) throw TestFailure('Nothing to tap: $finder\nVisible: ${visibleTexts()}');
    // A toast from the previous step may cover a bottom button; a user
    // would close it (✕) or wait. Clear it so the tap reaches the target.
    for (final element in find.byType(ScaffoldMessenger).evaluate()) {
      (element as StatefulElement).state is ScaffoldMessengerState
          ? (element.state as ScaffoldMessengerState).removeCurrentSnackBar()
          : null;
    }
    await tester.pump(const Duration(milliseconds: 50));
    // A relayout still in progress (keyboard insets closing) can move a lazy
    // list item out of the built range between the lookup and the tap;
    // look it up again in that case.
    for (var attempt = 0; ; attempt++) {
      if (finder.evaluate().isEmpty && scroll) await reveal(finder);
      try {
        final target = finder.first;
        if (scroll) {
          await tester.ensureVisible(target);
          await tester.pump(const Duration(milliseconds: 100));
        }
        await tester.tap(target, warnIfMissed: false);
        break;
      } on StateError {
        if (attempt >= 2) rethrow;
        await settle(4);
      }
    }
    await settle(3);
  }

  Future<void> tapText(String text, {bool last = false}) async {
    final finder = find.text(text);
    await waitFor(finder);
    await tap(last ? finder.last : finder.first);
  }

  /// The text field under the `LabeledField` whose label is [label]
  /// (labels are rendered upper-cased with Turkish rules).
  Finder field(String label) {
    final upper = label.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();
    final labeled = find.byWidgetPredicate(
      (w) => w is LabeledField && (w.label == label || w.label.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase() == upper),
    );
    return find.descendant(of: labeled, matching: find.byType(EditableText));
  }

  Future<void> type(Finder finder, String text) async {
    if (finder.evaluate().isEmpty) await reveal(finder);
    if (finder.evaluate().isEmpty) throw TestFailure('No field: $finder\nVisible: ${visibleTexts()}');
    await tester.ensureVisible(finder.first);
    await tester.pump(const Duration(milliseconds: 100));
    // WidgetTester.showKeyboard only attaches a new text-input connection
    // when the focused field changes; after a keyboard dismiss, typing into
    // the same field again would go to the closed connection and be lost.
    binding.focusedEditable = null;
    await tester.pump();
    await tester.enterText(finder.first, text);
    await settle(2);
  }

  Future<void> typeIn(String label, String text) => type(field(label), text);

  static String upperTr(String value) => value.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();

  /// Presses a button of the open dialog by its label (any casing).
  Future<void> dialogTap(String label) async {
    final dialog = find.byType(AlertDialog);
    await waitFor(dialog);
    final button = find.descendant(
      of: dialog,
      matching: find.byWidgetPredicate((w) => w is Text && w.data != null && upperTr(w.data!) == upperTr(label)),
    );
    if (button.evaluate().isEmpty) throw TestFailure('No dialog button "$label". Visible: ${visibleTexts()}');
    await tester.tap(button.last, warnIfMissed: false);
    await settle(4);
  }

  /// Closes any open dialog, bottom sheet or drawer.
  Future<void> closeOverlays() async {
    for (var i = 0; i < 4; i++) {
      final overlay = find.byWidgetPredicate((w) => w is AlertDialog || w is BottomSheet || w is Drawer || w is Dialog);
      if (overlay.evaluate().isEmpty) break;
      Navigator.of(tester.element(overlay.first)).pop();
      await settle(4);
    }
  }

  Future<void> dismissKeyboard() async {
    FocusManager.instance.primaryFocus?.unfocus();
    binding.focusedEditable = null;
    await settle(2);
  }

  Future<void> scrollDown([double dy = 400]) async {
    final scrollable = find.byType(Scrollable);
    if (scrollable.evaluate().isEmpty) return;
    await tester.drag(scrollable.first, Offset(0, -dy), warnIfMissed: false);
    await settle(3);
  }

  // --- Session -------------------------------------------------------------

  /// Signs in through the real login form.
  Future<void> login(String email, {String? password, String? returnTo}) async {
    if (services.auth.isSignedIn) await logout();
    // The suites sign in far more often than a person would; reset the
    // sandbox's login rate-limit buckets (disposable DB) so the server's
    // 10-per-account / 20-per-IP windows do not fail later scenarios.
    await ctl('ratereset');
    await go(returnTo == null ? '/login' : '/login?returnTo=${Uri.encodeComponent(returnTo)}');
    await waitFor(field('E-posta'));
    await typeIn('E-posta', email);
    await typeIn('Şifre', password ?? seedPassword);
    await tap(find.text('GİRİŞ YAP').last);
    await waitUntil(() async => services.auth.isSignedIn, what: 'sign-in of $email');
    await settle(6);
  }

  /// Signs out through the drawer's "Çıkış Yap" (server-side logout). The
  /// drawer path itself is verified in v01 (F-AUTH-06); if a previous failed
  /// scenario left the UI in an odd state, fall back to the same controller
  /// call so the following scenarios start clean.
  Future<void> logout() async {
    if (!services.auth.isSignedIn) return;
    try {
      await closeOverlays();
      await go('/');
      await waitFor(find.byTooltip('Gezinme menüsünü aç'), timeout: const Duration(seconds: 6));
      await tester.tap(find.byTooltip('Gezinme menüsünü aç').first, warnIfMissed: false);
      await settle(4);
      await waitFor(find.text('KURUMSAL'), timeout: const Duration(seconds: 6));
      await reveal(find.text('ÇIKIŞ YAP'));
      await tap(find.text('ÇIKIŞ YAP'));
      await waitUntil(() async => !services.auth.isSignedIn, what: 'sign-out', timeout: const Duration(seconds: 8));
    } catch (_) {
      note('LOGOUT-FALLBACK at $location');
      await closeOverlays();
      await services.auth.logout();
    }
    await settle(6);
  }

  // --- Real device input (Android emulator, through adb) ---------------------
  //
  // These go through the operating system: the touch reaches the app as a
  // real pointer event and text is typed by the emulator's input method, the
  // same path as the on-screen keyboard. The framework's test text input is
  // switched off while they are used.

  Offset _physical(Offset logical) => logical * tester.view.devicePixelRatio;

  Future<void> adbTapAt(Offset logical) async {
    final p = _physical(logical);
    await ctl('adb', {
      'args': ['input', 'tap', '${p.dx.round()}', '${p.dy.round()}'],
    });
    await settle(4);
  }

  Future<void> adbLongPressAt(Offset logical, {int ms = 900}) async {
    final p = _physical(logical);
    await ctl('adb', {
      'args': ['input', 'swipe', '${p.dx.round()}', '${p.dy.round()}', '${p.dx.round()}', '${p.dy.round()}', '$ms'],
    });
    await settle(6);
  }

  /// ASCII only (adb limitation); spaces are sent as %s.
  Future<void> adbText(String text) async {
    for (final word in text.split(' ').indexed) {
      if (word.$1 > 0) await adbKey(62); // KEYCODE_SPACE
      if (word.$2.isEmpty) continue;
      await ctl('adb', {
        'args': ['input', 'text', word.$2.replaceAll("'", '')],
      });
      await settle(2);
    }
  }

  Future<void> adbKey(int keyCode) async {
    await ctl('adb', {
      'args': ['input', 'keyevent', '$keyCode'],
    });
    await settle(2);
  }

  /// Types into the focused editor through the platform text-input channel
  /// (what the iOS/Android keyboard does): the editor receives a new editing
  /// value with [text] inserted at the selection.
  Future<void> imeType(String text) async {
    final state = tester.testTextInput.editingState;
    if (state == null) throw TestFailure('No text-input client is attached');
    final current = state['text'] as String;
    final base = state['selectionBase'] as int;
    final extent = state['selectionExtent'] as int;
    final start = base < extent ? base : extent;
    final end = base < extent ? extent : base;
    final next = current.replaceRange(start, end, text);
    tester.testTextInput.updateEditingValue(
      TextEditingValue(
        text: next,
        selection: TextSelection.collapsed(offset: start + text.length),
      ),
    );
    await settle(3);
  }

  // --- Backend -------------------------------------------------------------

  /// GraphQL as the signed-in app user (same client as the app).
  Future<Json> gql(String document, [Json variables = const {}]) => services.api.run(document, variables: variables);

  /// Independent API session for a role (setup and cross-account checks).
  Future<GraphQLClient> apiAs(String email, {String? password}) async {
    String? token;
    final client = GraphQLClient(endpoint: services.config.apiUrl, readToken: () => token);
    final data = await client.run(
      r'mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { id } } }',
      variables: {'email': email, 'password': password ?? seedPassword},
    );
    token = (data['login'] as Map)['token'] as String;
    return client;
  }

  GraphQLClient apiWithToken(String? token) => GraphQLClient(endpoint: services.config.apiUrl, readToken: () => token);

  /// Diagnostic line in the host-side log (device stdout is not collected on iOS).
  void note(String text) {
    // ignore: avoid_print
    print('NOTE $text');
    http
        .post(Uri.parse('$ctlUrl/log'), body: jsonEncode({'platform': platformName, 'suite': suite, 'note': text}))
        .catchError((_) => http.Response('', 500));
  }

  Future<dynamic> ctl(String name, [Json body = const {}]) async {
    final response = await http.post(Uri.parse('$ctlUrl/$name'), body: jsonEncode(body)).timeout(const Duration(seconds: 30));
    final decoded = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    if (decoded['ok'] != true) throw TestFailure('ctl $name failed: ${decoded['error']}');
    return decoded['result'];
  }

  Future<List<dynamic>> dbFind(String collection, [Json filter = const {}, int limit = 5]) async =>
      (await ctl('find', {'collection': collection, 'filter': filter, 'limit': limit}) as List);

  Future<int> dbCount(String collection, [Json filter = const {}]) async =>
      (await ctl('count', {'collection': collection, 'filter': filter}) as num).toInt();

  static Json oid(String id) => {r'$oid': id};

  Future<Map<String, dynamic>?> latestMail({String? to, String? subject, String? text}) async {
    final result = await ctl('mail', {'to': to, 'subject': subject, 'text': text});
    return result == null ? null : Map<String, dynamic>.from(result as Map);
  }

  /// Real device screenshot (status bar, keyboard and system UI included).
  Future<void> shot(String name) async {
    await settle(3);
    try {
      await ctl('shot', {'name': '${platformName}_${suite}_$name', 'platform': platformName});
    } catch (error) {
      // Evidence only; never fail a scenario for it.
      // ignore: avoid_print
      print('SHOT-FAILED $name $error');
    }
  }

  // --- Scenarios -----------------------------------------------------------

  /// Runs one verification scenario; a failure is recorded and the suite
  /// continues with the next one.
  Future<bool> scenario(String id, String name, Future<void> Function() body) async {
    _flutterErrors.clear();
    tester.takeException();
    String detail = '';
    var ok = true;
    var skipped = false;
    try {
      await body();
      final pending = tester.takeException();
      if (pending != null) {
        ok = false;
        detail = 'Flutter exception: ${pending.toString().split('\n').first}';
      } else if (_flutterErrors.isNotEmpty) {
        ok = false;
        detail = 'Flutter error: ${_flutterErrors.first}';
      }
    } on SkipScenario catch (skip) {
      skipped = true;
      detail = skip.reason;
    } catch (error, stack) {
      ok = false;
      detail = error.toString().split('\n').take(3).join(' / ');
      if (error is! TestFailure) {
        detail += ' @ ${stack.toString().split('\n').where((l) => l.contains('integration_test/')).take(2).join(' <- ')}';
      }
      final pending = tester.takeException();
      if (pending != null) detail += ' [exception: ${pending.toString().split('\n').first}]';
      await shot('FAIL_${id}_${results.length}');
      await _recover();
    }
    results.add(ScenarioResult(id, name, ok, detail));
    final line = 'SCENARIO|$platformName|$suite|$id|${skipped ? 'SKIP' : (ok ? 'PASS' : 'FAIL')}|$name|$detail';
    // ignore: avoid_print
    print(line);
    try {
      await ctl('log', {'platform': platformName, 'suite': suite, 'id': id, 'name': name, 'ok': ok, 'skipped': skipped, 'detail': detail});
    } catch (_) {}
    return ok;
  }

  Future<void> _recover() async {
    try {
      await dismissKeyboard();
      await closeOverlays();
      // Close dialogs / sheets / pushed routes.
      for (var i = 0; i < 6; i++) {
        final navigator = tester.state<NavigatorState>(find.byType(Navigator).first);
        if (!navigator.canPop()) break;
        navigator.pop();
        await settle(3);
      }
      router.go('/');
      await settle(6);
    } catch (_) {}
    tester.takeException();
  }

  void finish() {
    final failed = results.where((r) => !r.ok).toList();
    // ignore: avoid_print
    print('SUITE|$platformName|$suite|${results.length - failed.length}/${results.length} passed');
    if (failed.isNotEmpty) {
      fail('${failed.length} scenario(s) failed:\n${failed.map((r) => '${r.id} ${r.name}: ${r.detail}').join('\n')}');
    }
  }
}

/// Clipboard content as the platform reports it.
/// Android 10+ returns nothing while the app momentarily lacks input focus
/// (e.g. right after a toolbar or sheet closes), so retry briefly.
Future<String> clipboardText() async {
  for (var attempt = 0; attempt < 10; attempt++) {
    final text = (await Clipboard.getData('text/plain'))?.text ?? '';
    if (text.isNotEmpty) return text;
    await Future<void>.delayed(const Duration(milliseconds: 300));
  }
  return '';
}

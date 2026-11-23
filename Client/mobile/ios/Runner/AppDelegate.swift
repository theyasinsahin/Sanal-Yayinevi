import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "BetikPlatformConfig") {
      BetikPlatformConfig.register(with: registrar.messenger())
    }
  }
}

/// Read-only build facts for Dart. Google sign-in uses it to check that the
/// reversed iOS client id is a registered URL scheme before calling the
/// GoogleSignIn SDK, which raises an uncatchable exception (app crash)
/// when the scheme is missing.
enum BetikPlatformConfig {
  static func register(with messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "betik/platform_config", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "urlSchemes":
        let types = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] ?? []
        result(types.flatMap { $0["CFBundleURLSchemes"] as? [String] ?? [] }.filter { !$0.isEmpty })
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}

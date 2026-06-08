import AppKit
import WebKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)

        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 960),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        window.title = "Carson"
        window.minSize = NSSize(width: 960, height: 640)
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)

        self.window = window
        self.webView = webView

        loadWebApp()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func loadWebApp() {
        guard let resourceURL = Bundle.main.resourceURL else {
            showLoadError("Missing app resources.")
            return
        }

        let webRootURL = resourceURL.appendingPathComponent("web", isDirectory: true)
        let indexURL = webRootURL.appendingPathComponent("index.html")

        guard FileManager.default.fileExists(atPath: indexURL.path) else {
            showLoadError("Missing built web app. Run the build script again.")
            return
        }

        webView?.loadFileURL(indexURL, allowingReadAccessTo: webRootURL)
    }

    private func showLoadError(_ message: String) {
        let label = NSTextField(labelWithString: message)
        label.alignment = .center
        label.font = .systemFont(ofSize: 16)
        window?.contentView = label
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()

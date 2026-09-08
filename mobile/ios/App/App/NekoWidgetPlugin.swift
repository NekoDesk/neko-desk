import Foundation
import Capacitor
import WidgetKit

@objc(NekoWidgetPlugin)
public class NekoWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NekoWidgetPlugin"
    public let jsName = "NekoWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "push", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToggles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingToggles", returnType: CAPPluginReturnPromise)
    ]

    @objc func push(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("json 파라미터 없음")
            return
        }
        guard let defaults = UserDefaults(suiteName: "group.com.siwon.nekodesk.mobile") else {
            call.reject("App Group 접근 실패")
            return
        }
        defaults.set(json.data(using: .utf8), forKey: "neko_widget_data")
        defaults.synchronize()

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    @objc func getToggles(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: "group.com.siwon.nekodesk.mobile") else {
            call.resolve(["toggles": [] as [Any], "waterAdd": 0, "vitaAdd": 0])
            return
        }

        var toggles: [Any] = []
        if let data = defaults.data(forKey: "neko_pending_toggles"),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [Any] {
            toggles = parsed
        }
        let waterAdd = defaults.integer(forKey: "neko_pending_water_add")
        let vitaAdd = defaults.integer(forKey: "neko_pending_vita_add")
        let catFeed = defaults.integer(forKey: "neko_pending_cat_feed")
        let catPlay = defaults.integer(forKey: "neko_pending_cat_play")

        defaults.removeObject(forKey: "neko_pending_water_add")
        defaults.removeObject(forKey: "neko_pending_vita_add")
        defaults.removeObject(forKey: "neko_pending_cat_feed")
        defaults.removeObject(forKey: "neko_pending_cat_play")
        defaults.synchronize()

        call.resolve(["toggles": toggles, "waterAdd": waterAdd, "vitaAdd": vitaAdd,
                       "catFeed": catFeed, "catPlay": catPlay])
    }

    @objc func clearPendingToggles(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: "group.com.siwon.nekodesk.mobile") else {
            call.resolve()
            return
        }
        defaults.removeObject(forKey: "neko_pending_toggles")
        defaults.synchronize()
        call.resolve()
    }
}

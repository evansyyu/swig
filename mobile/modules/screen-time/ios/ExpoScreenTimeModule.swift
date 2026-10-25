import Combine
import ExpoModulesCore
import FamilyControls
import SwiftUI

public class ExpoScreenTimeModule: Module {
  private let store = BlockGroupStore()
  private var authorizationObserver: AnyCancellable?

  public func definition() -> ModuleDefinition {
    Name("ExpoScreenTime")

    Events("onAuthorizationStatusChange")

    OnStartObserving {
      self.authorizationObserver = AuthorizationCenter.shared.$authorizationStatus
        .removeDuplicates()
        .receive(on: DispatchQueue.main)
        .sink { [weak self] status in
          self?.sendEvent("onAuthorizationStatusChange", ["status": status.jsValue])
        }
    }

    OnStopObserving {
      self.authorizationObserver = nil
    }

    Function("getAuthorizationStatus") {
      AuthorizationCenter.shared.authorizationStatus.jsValue
    }

    AsyncFunction("requestAuthorizationAsync") { () async throws -> String in
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
      } catch {
        // A denial also throws; only surface errors that left the status undetermined.
        if AuthorizationCenter.shared.authorizationStatus == .notDetermined {
          throw error
        }
      }
      return AuthorizationCenter.shared.authorizationStatus.jsValue
    }

    AsyncFunction("revokeAuthorizationAsync") { (promise: Promise) in
      _ = self.store.disableAll()
      AuthorizationCenter.shared.revokeAuthorization { result in
        switch result {
        case .success:
          promise.resolve(AuthorizationCenter.shared.authorizationStatus.jsValue)
        case .failure(let error):
          promise.reject(error)
        }
      }
    }

    /// Synchronous so the first render already has persisted state.
    Function("registerGroups") { (definitions: [BlockGroupDefinition]) -> [BlockGroupSummary] in
      self.store.register(definitions)
    }

    AsyncFunction("setGroupEnabledAsync") { (id: String, enabled: Bool) throws -> BlockGroupSummary in
      if enabled && AuthorizationCenter.shared.authorizationStatus != .approved {
        throw NotAuthorizedException()
      }
      return try self.store.setEnabled(enabled, for: id)
    }

    AsyncFunction("disableAllAsync") { () -> [BlockGroupSummary] in
      self.store.disableAll()
    }

    /// Resolves with the updated summary, or `null` when the user cancels.
    AsyncFunction("presentPickerAsync") { (id: String, promise: Promise) in
      guard AuthorizationCenter.shared.authorizationStatus == .approved else {
        throw NotAuthorizedException()
      }
      let group = try self.store.group(for: id)
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        throw PickerUnavailableException()
      }

      var controller: UIViewController?
      let sheet = ActivityPickerSheet(title: group.name, selection: group.selection) { [weak self] result in
        controller?.dismiss(animated: true)
        // Breaks the controller -> rootView -> closure retain cycle.
        controller = nil
        guard let self, let result else {
          promise.resolve(nil)
          return
        }
        do {
          promise.resolve(try self.store.setSelection(result, for: id))
        } catch {
          promise.reject(error)
        }
      }
      let hosting = UIHostingController(rootView: sheet)
      // Forces Cancel/Done so the promise always settles.
      hosting.isModalInPresentation = true
      controller = hosting
      presenter.present(hosting, animated: true)
    }
    .runOnQueue(.main)
  }
}

private extension AuthorizationStatus {
  var jsValue: String {
    switch self {
    case .notDetermined: return "notDetermined"
    case .denied: return "denied"
    case .approved: return "approved"
    @unknown default: return "notDetermined"
    }
  }
}

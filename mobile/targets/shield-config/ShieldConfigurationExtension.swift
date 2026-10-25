import FamilyControls
import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Mirrors `StoredBlockGroup` in modules/screen-time/ios/BlockGroupStore.swift.
private struct StoredBlockGroup: Decodable {
  var name: String
  var enabled: Bool
  var selection: FamilyActivitySelection
}

class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  override func configuration(shielding application: Application) -> ShieldConfiguration {
    makeConfiguration(
      subject: application.localizedDisplayName,
      groupName: groupName { $0.applicationTokens.contains(token: application.token) }
    )
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    makeConfiguration(
      subject: application.localizedDisplayName,
      groupName: groupName {
        $0.applicationTokens.contains(token: application.token) || $0.categoryTokens.contains(token: category.token)
      }
    )
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    makeConfiguration(
      subject: webDomain.domain,
      groupName: groupName { $0.webDomainTokens.contains(token: webDomain.token) }
    )
  }

  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
    makeConfiguration(
      subject: webDomain.domain,
      groupName: groupName {
        $0.webDomainTokens.contains(token: webDomain.token) || $0.categoryTokens.contains(token: category.token)
      }
    )
  }

  // MARK: - Helpers

  private func makeConfiguration(subject: String?, groupName: String?) -> ShieldConfiguration {
    // Swig palette: navy ink, steel accent, peach highlight (see src/theme/colors.ts).
    let navy = UIColor(red: 0x1E / 255, green: 0x31 / 255, blue: 0x56 / 255, alpha: 1)
    let steel = UIColor(red: 0x53 / 255, green: 0x69 / 255, blue: 0x92 / 255, alpha: 1)
    let peach = UIColor(red: 0xFB / 255, green: 0xE2 / 255, blue: 0xD2 / 255, alpha: 1)
    let ink = UIColor { $0.userInterfaceStyle == .dark ? .white : navy }
    let subtitle = "You've fallen behind on water, so \(groupName ?? "this app") is paused. "
      + "Drink a glass, then open Swig to unlock."
    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterial,
      backgroundColor: peach.withAlphaComponent(0.35),
      icon: UIImage(systemName: "drop.fill")?.withTintColor(steel, renderingMode: .alwaysOriginal),
      title: ShieldConfiguration.Label(text: "Time for a sip before \(subject ?? "this app")", color: ink),
      subtitle: ShieldConfiguration.Label(text: subtitle, color: .secondaryLabel),
      primaryButtonLabel: ShieldConfiguration.Label(text: "Close", color: .white),
      primaryButtonBackgroundColor: steel
    )
  }

  private func groupName(where matches: (FamilyActivitySelection) -> Bool) -> String? {
    // App Group is `group.<host app bundle id>`; this extension's id is `<host app bundle id>.shieldconfig`.
    guard let bundleId = Bundle.main.bundleIdentifier else { return nil }
    let hostBundleId = bundleId.split(separator: ".").dropLast().joined(separator: ".")
    guard let defaults = UserDefaults(suiteName: "group.\(hostBundleId)"),
          let data = defaults.data(forKey: "blockGroups"),
          let groups = try? JSONDecoder().decode([String: StoredBlockGroup].self, from: data)
    else { return nil }

    return groups.values.first { $0.enabled && matches($0.selection) }?.name
  }
}

private extension Set {
  func contains<Token>(token: Token?) -> Bool where Element == Token {
    guard let token else { return false }
    return contains(token)
  }
}

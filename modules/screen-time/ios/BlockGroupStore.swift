import FamilyControls
import Foundation
import ManagedSettings

/// Persisted state for one block group. The shield configuration extension decodes the same
/// JSON shape (see targets/shield-config/ShieldConfigurationExtension.swift), so keep them in sync.
struct StoredBlockGroup: Codable {
  var name: String
  var enabled: Bool
  var selection: FamilyActivitySelection
}

/// Owns block group persistence (App Group defaults, readable by extensions) and applies
/// shields through one named `ManagedSettingsStore` per group, so groups toggle independently.
final class BlockGroupStore {
  static let storageKey = "blockGroups"

  /// App Group is derived from the bundle identifier: `group.<bundle id>`.
  private let defaults: UserDefaults = {
    let bundleId = Bundle.main.bundleIdentifier ?? ""
    return UserDefaults(suiteName: "group.\(bundleId)") ?? .standard
  }()

  // Sync functions run on the JS thread and async ones on main, so guard shared state.
  private let lock = NSLock()
  private var groups: [String: StoredBlockGroup] = [:]

  init() {
    if let data = defaults.data(forKey: Self.storageKey),
       let decoded = try? JSONDecoder().decode([String: StoredBlockGroup].self, from: data) {
      groups = decoded
    }
  }

  /// Ensures every given group exists (keeping persisted selections) and refreshes names.
  func register(_ definitions: [BlockGroupDefinition]) -> [BlockGroupSummary] {
    lock.withLock {
      for definition in definitions {
        if groups[definition.id] == nil {
          groups[definition.id] = StoredBlockGroup(
            name: definition.name,
            enabled: false,
            selection: FamilyActivitySelection()
          )
        } else {
          groups[definition.id]?.name = definition.name
        }
      }
      persist()
      return definitions.compactMap { summary(for: $0.id) }
    }
  }

  func group(for id: String) throws -> StoredBlockGroup {
    try lock.withLock {
      guard let group = groups[id] else { throw UnknownGroupException(id) }
      return group
    }
  }

  func setSelection(_ selection: FamilyActivitySelection, for id: String) throws -> BlockGroupSummary {
    try lock.withLock {
      guard var group = groups[id] else { throw UnknownGroupException(id) }
      group.selection = selection
      if selection.isEmpty {
        group.enabled = false
      }
      groups[id] = group
      // Re-apply so an active block picks up the new selection immediately.
      apply(id)
      persist()
      return summary(for: id)!
    }
  }

  func setEnabled(_ enabled: Bool, for id: String) throws -> BlockGroupSummary {
    try lock.withLock {
      guard var group = groups[id] else { throw UnknownGroupException(id) }
      if enabled && group.selection.isEmpty {
        throw EmptySelectionException(group.name)
      }
      group.enabled = enabled
      groups[id] = group
      apply(id)
      persist()
      return summary(for: id)!
    }
  }

  func disableAll() -> [BlockGroupSummary] {
    lock.withLock {
      for id in groups.keys {
        groups[id]?.enabled = false
        apply(id)
      }
      persist()
      return groups.keys.sorted().compactMap { summary(for: $0) }
    }
  }

  // MARK: - Private (call with lock held)

  private func apply(_ id: String) {
    guard let group = groups[id] else { return }
    let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("blockGroup.\(id)"))
    guard group.enabled else {
      store.clearAllSettings()
      return
    }
    let selection = group.selection
    let categories = selection.categoryTokens
    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.applicationCategories = categories.isEmpty ? nil : .specific(categories)
    store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    store.shield.webDomainCategories = categories.isEmpty ? nil : .specific(categories)
  }

  private func persist() {
    guard let data = try? JSONEncoder().encode(groups) else { return }
    defaults.set(data, forKey: Self.storageKey)
  }

  private func summary(for id: String) -> BlockGroupSummary? {
    guard let group = groups[id] else { return nil }
    var summary = BlockGroupSummary()
    summary.id = id
    summary.enabled = group.enabled
    summary.appCount = group.selection.applicationTokens.count
    summary.categoryCount = group.selection.categoryTokens.count
    summary.webDomainCount = group.selection.webDomainTokens.count
    return summary
  }
}

extension FamilyActivitySelection {
  var isEmpty: Bool {
    applicationTokens.isEmpty && categoryTokens.isEmpty && webDomainTokens.isEmpty
  }
}

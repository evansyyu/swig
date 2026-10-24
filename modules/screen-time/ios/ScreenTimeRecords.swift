import ExpoModulesCore

struct BlockGroupDefinition: Record {
  @Field var id: String = ""
  @Field var name: String = ""
}

/// Lightweight view of a group sent to JS. Activity tokens are opaque and never leave native.
struct BlockGroupSummary: Record {
  @Field var id: String = ""
  @Field var enabled: Bool = false
  @Field var appCount: Int = 0
  @Field var categoryCount: Int = 0
  @Field var webDomainCount: Int = 0
}

final class UnknownGroupException: GenericException<String> {
  override var reason: String {
    "Unknown block group '\(param)'. Call registerGroups first."
  }
}

final class EmptySelectionException: GenericException<String> {
  override var reason: String {
    "'\(param)' has no apps selected."
  }
}

final class NotAuthorizedException: Exception {
  override var reason: String {
    "Screen Time access has not been granted."
  }
}

final class PickerUnavailableException: Exception {
  override var reason: String {
    "Unable to find a view controller to present the app picker."
  }
}

import FamilyControls
import SwiftUI

/// Wraps `FamilyActivityPicker` with explicit Cancel/Done actions so the result is only
/// committed when the user confirms.
struct ActivityPickerSheet: View {
  let title: String
  let onFinish: (FamilyActivitySelection?) -> Void

  @State private var selection: FamilyActivitySelection

  init(title: String, selection: FamilyActivitySelection, onFinish: @escaping (FamilyActivitySelection?) -> Void) {
    self.title = title
    self.onFinish = onFinish
    _selection = State(initialValue: selection)
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { onFinish(nil) }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") { onFinish(selection) }
          }
        }
    }
  }
}

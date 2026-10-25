Pod::Spec.new do |s|
  s.name           = 'ExpoScreenTime'
  s.version        = '1.0.0'
  s.summary        = 'FamilyControls + ManagedSettings bridge for app blocking'
  s.description    = 'Authorizes Screen Time access, presents FamilyActivityPicker and shields selected apps per group.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'SwiftUI'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

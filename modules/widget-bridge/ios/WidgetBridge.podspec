Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Native bridge for writing widget snapshot data to a shared App Group container'
  s.description    = 'Writes the caregiver app widget snapshot JSON into the shared App Group container so the home screen widget extension can read it.'
  s.author         = 'VVision-App'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: 'https://github.com/ZaydSayeed/VVision-App' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

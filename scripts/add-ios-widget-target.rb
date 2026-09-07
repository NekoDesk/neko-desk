#!/usr/bin/env ruby
# Xcode 프로젝트에 NekoWidget Extension 타겟을 추가한다.
# Codemagic 빌드에서 pod install 전에 실행한다.
#   gem install xcodeproj && ruby scripts/add-ios-widget-target.rb

require 'xcodeproj'

PROJ_PATH  = File.join(__dir__, '..', 'mobile', 'ios', 'App', 'App.xcodeproj')
WIDGET_DIR = File.join(__dir__, '..', 'mobile', 'ios', 'NekoWidget')
BUNDLE_ID  = 'com.siwon.nekodesk.mobile.widget'
TEAM_ID    = 'K9MGP9D5LK'

project = Xcodeproj::Project.open(PROJ_PATH)

# 이미 추가돼 있으면 건너뛴다
if project.targets.any? { |t| t.name == 'NekoWidget' }
  puts 'NekoWidget 타겟이 이미 있습니다 — 건너뜁니다.'
  exit 0
end

# ── 파일 참조 추가 ──
widget_group = project.main_group.new_group('NekoWidget', WIDGET_DIR)
swift_files = Dir.glob(File.join(WIDGET_DIR, '*.swift'))
plist_ref   = widget_group.new_file(File.join(WIDGET_DIR, 'Info.plist'))
entitlements_ref = widget_group.new_file(File.join(WIDGET_DIR, 'NekoWidget.entitlements'))

# ── 타겟 생성 ──
target = project.new_target(:app_extension, 'NekoWidget', :ios, '14.0')
target.product_name = 'NekoWidgetExtension'

# 소스 파일 추가
swift_files.each do |path|
  ref = widget_group.new_file(path)
  target.source_build_phase.add_file_reference(ref)
end

# ── 빌드 설정 ──
target.build_configurations.each do |config|
  s = config.build_settings
  s['PRODUCT_BUNDLE_IDENTIFIER']  = BUNDLE_ID
  s['INFOPLIST_FILE']             = '$(SRCROOT)/../NekoWidget/Info.plist'
  s['CODE_SIGN_ENTITLEMENTS']     = '$(SRCROOT)/../NekoWidget/NekoWidget.entitlements'
  s['CODE_SIGN_STYLE']            = 'Manual'
  s['DEVELOPMENT_TEAM']           = TEAM_ID
  s['SWIFT_VERSION']              = '5.0'
  s['TARGETED_DEVICE_FAMILY']     = '1,2'
  s['MARKETING_VERSION']          = '1.0'
  s['CURRENT_PROJECT_VERSION']    = '1'
  s['GENERATE_INFOPLIST_FILE']    = 'NO'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
  s['SKIP_INSTALL']               = 'YES'
end

# ── 메인 앱에 Embed 추가 ──
app_target = project.targets.find { |t| t.name == 'App' }

# 메인 앱에도 팀 ID와 entitlements 설정
app_target.build_configurations.each do |config|
  s = config.build_settings
  s['DEVELOPMENT_TEAM'] = TEAM_ID
  s['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end

# Embed App Extensions 빌드 페이즈
embed_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13'  # PlugIns
embed_phase.add_file_reference(target.product_reference)

# 의존성 추가
app_target.add_dependency(target)

project.save
puts "NekoWidget Extension 타겟 추가 완료 (#{swift_files.length}개 Swift 파일)"

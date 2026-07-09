const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Newer Xcode/Clang toolchains enforce stricter C++20 `consteval` rules than
 * the `fmt` pod (a transitive dependency of glog/Folly, pulled in by React
 * Native) expects from its FMT_STRING macro — this fails with
 * "call to consteval function ... is not a constant expression".
 *
 * A GCC_PREPROCESSOR_DEFINITIONS override for FMT_CONSTEVAL did NOT work —
 * fmt's own header-guard logic decides whether to use `consteval` based on
 * detecting compiler/language support, not solely via that macro. The
 * mechanically certain fix: force the fmt pod's own translation units to
 * compile under C++17, where the `consteval` keyword doesn't exist at all,
 * so fmt's `#if __cplusplus >= 202002L` (C++20) guards can't select the
 * consteval code path regardless of how complete Clang's C++20 support is.
 *
 * CocoaPods only allows ONE `post_install do |installer| ... end` block per
 * Podfile, so this must be spliced INTO the existing block (right after
 * Expo's own `react_native_post_install(...)` call), not appended as a
 * second top-level block.
 */
const MARKER = "# withFmtConstevalFix";

const PATCH = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |build_config|
          build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'
        end
      end
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfilePath, "utf8");

      if (contents.includes(MARKER)) {
        return config;
      }

      const reactNativePostInstallCallRegex = /(react_native_post_install\(\s*[\s\S]*?\n\s*\))/;
      const match = contents.match(reactNativePostInstallCallRegex);
      if (!match) {
        throw new Error(
          "withFmtConstevalFix: could not find react_native_post_install(...) call in Podfile to splice into"
        );
      }

      contents = contents.replace(reactNativePostInstallCallRegex, `$1\n${PATCH}`);
      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

// RN 0.86 deprecates only RawPropsParser(bool), not the parser itself.
// Remove when Expo adopts the default constructor upstream.
const fs = require("fs");
const path = require("path");
const root = path.dirname(require.resolve("expo-modules-core/package.json"));
const file = path.join(
  root,
  "android/src/main/cpp/fabric/ExpoComponentDescriptorFactory.cpp",
);
const old = "react::RawPropsParser(/*useRawPropsJsiValue=*/true)";
const replacement = "react::RawPropsParser()";
const source = fs.readFileSync(file, "utf8");
if (source.includes(old)) {
  fs.writeFileSync(file, source.replace(old, replacement));
  console.log("Applied Expo RawPropsParser compatibility fix.");
} else if (!source.includes(replacement))
  throw new Error(
    "Expo props parser changed; review compatibility patch before building.",
  );

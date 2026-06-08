// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "Carson",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "Carson", targets: ["Carson"])
    ],
    targets: [
        .executableTarget(
            name: "Carson",
            path: "macos/Sources/Carson"
        )
    ]
)

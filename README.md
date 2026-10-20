# M18 Bench

Unofficial workbench for Milwaukee M18 battery packs. Windows and Android can read a pack over a 3.3 V USB-serial adapter. iPhone and iPad can play the sample packs, name batteries, and import logs. They cannot open the USB-C port.

Not affiliated with Milwaukee Electric Tool.

The wire protocol is the community map in [mnh-jansson/m18-protocol](https://github.com/mnh-jansson/m18-protocol). This app does not replace that script. It is a bench on top of the same read, checksum, and health rules.

## Windows

1. Install [Node.js 22](https://nodejs.org/).
2. `npm ci`
3. `npm run dev`
4. Open the page in Microsoft Edge or Chrome. A chat preview cannot see USB devices.
5. Install it from the browser menu if you want a taskbar app.
6. Hold the adapter TX line low, then clip J1, J2, and B−. Do not connect the adapter straight to the pack terminals.

Sample packs are on the health screen until a pack is connected: Healthy XC 5.0, Tired HO 8.0, Sagging Forge 12.0.

The Debug tab names the FT232 variant (R, H, 2232H, 4232H, 2232C, B, BM, FT-X), sets the baud clock, and runs a communication test. On iPhone the test stops at the missing port. On Windows and Android it opens the cable and checks reset, 4800 8N2, the latency timer, modem status, a read-only EEPROM word, and break. Nothing is written to EEPROM.

## iOS and Play

Both phone apps are submitted and waiting for review.

- **iOS.** App Store review. Bundle id `app.m18bench`, version 1.0.0, LineSpotting AB. Sample packs, battery names, and log import. The phone does not open the USB-C port. Debug says so.
- **Google Play.** The Android build is in review. Chrome on the phone can open a 3.3 V USB-C serial adapter the same way Windows does.

Until review finishes, the bench you can run today is this repo on Windows. Identity for the iOS build is in `PRODUCT.yaml`.

## Microsoft Store

The Store package is the same bench GUI in its own window. Icons, listing text, and the MSIX manifest are in `store/windows`. The package is not submitted yet. iOS and Play are the builds waiting on review.

On a Windows PC, from the repo root:

```
$env:M18_STORE_PUBLISHER = "CN=your-partner-center-publisher"
powershell -File store\windows\build-msix.ps1
```

That builds `store\windows\out\M18Bench-1.0.0.0-x64.msix`. Sign it with the Partner Center publisher before upload. `runFullTrust` is there so the window can open a USB serial port.

## Safety

The adapter is 3.3 V UART. Releasing the line while J2 is high can increment the pack's dumb-charge counter. Do not write registers you do not mean to change.

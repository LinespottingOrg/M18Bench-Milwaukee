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

## iOS

Identity is pinned in `PRODUCT.yaml`. The phone build is a local Xcode archive of this web bench. TestFlight internal only. USB diagnosis stays on Windows or Android.

## Safety

The adapter is 3.3 V UART. Releasing the line while J2 is high can increment the pack's dumb-charge counter. Do not write registers you do not mean to change.

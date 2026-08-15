# Job Tayari native messaging host

The host uses Chrome's length-prefixed JSON stdio protocol and accepts only the
small typed method set in `policy.go`. Every method except `get_status` needs a
capability token supplied by `TAYARI_NATIVE_CAPABILITY_TOKEN` or the user's
native capability file. Install the generated host with `TAYARI_EXTENSION_ID=<published-extension-id> native-host/installers/install.sh` on macOS/Linux, or run `install.ps1 -ExtensionId <id>` on Windows. Final application submission is not implemented by this bridge.

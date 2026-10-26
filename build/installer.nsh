; 一键安装默认用 package.json 的 name (小写) 作为目录名, 首次安装时改为 productName
; 已安装过的保留原位置, 升级不搬家
!macro preInit
  !ifndef BUILD_UNINSTALLER
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${if} $0 == ""
      WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\${PRODUCT_FILENAME}"
    ${endif}
  !endif
!macroend

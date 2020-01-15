// @flow

const builtinClasses: Set<string> = new Set([
  'Object',
  'Function',
  'Array',
  'Number',
  'Boolean',
  'String',
  'Symbol',
  'Date',
  'Promise',
  'RegExp',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'JSON',
  'Math',
  'Intl',
  'ArrayBuffer',
  'Uint8Array',
  'Int8Array',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'Uint8ClampedArray',
  'DataView',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Proxy',
  'Reflect',
  'SharedArrayBuffer',
  'Atomics',
  'WebAssembly',
  'Buffer',
  'Object',
  'Function',
  'Array',
  'Number',
  'Boolean',
  'String',
  'Symbol',
  'Date',
  'Promise',
  'RegExp',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'JSON',
  'Math',
  'Intl',
  'ArrayBuffer',
  'Uint8Array',
  'Int8Array',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'Uint8ClampedArray',
  'BigUint64Array',
  'BigInt64Array',
  'DataView',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Proxy',
  'Reflect',
  'ByteLengthQueuingStrategy',
  'CountQueuingStrategy',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'WebSocket',
  'WebGLContextEvent',
  'WaveShaperNode',
  'TextEncoder',
  'TextDecoder',
  'SyncManager',
  'SubtleCrypto',
  'StorageEvent',
  'Storage',
  'StereoPannerNode',
  'SourceBufferList',
  'SourceBuffer',
  'ScriptProcessorNode',
  'ScreenOrientation',
  'RTCTrackEvent',
  'RTCStatsReport',
  'RTCSessionDescription',
  'RTCRtpTransceiver',
  'RTCRtpSender',
  'RTCRtpReceiver',
  'RTCRtpContributingSource',
  'RTCPeerConnectionIceEvent',
  'RTCPeerConnection',
  'RTCIceCandidate',
  'RTCDataChannelEvent',
  'RTCDataChannel',
  'RTCDTMFToneChangeEvent',
  'RTCDTMFSender',
  'RTCCertificate',
  'Plugin',
  'PluginArray',
  'PhotoCapabilities',
  'PeriodicWave',
  'PannerNode',
  'OverconstrainedError',
  'OscillatorNode',
  'OfflineAudioContext',
  'OfflineAudioCompletionEvent',
  'NetworkInformation',
  'MimeType',
  'MimeTypeArray',
  'MediaStreamTrackEvent',
  'MediaStreamTrack',
  'MediaStreamEvent',
  'MediaStream',
  'MediaStreamAudioSourceNode',
  'MediaStreamAudioDestinationNode',
  'MediaSource',
  'MediaSettingsRange',
  'MediaRecorder',
  'MediaEncryptedEvent',
  'MediaElementAudioSourceNode',
  'MediaDevices',
  'MediaDeviceInfo',
  'MediaCapabilities',
  'MIDIPort',
  'MIDIOutputMap',
  'MIDIOutput',
  'MIDIMessageEvent',
  'MIDIInputMap',
  'MIDIInput',
  'MIDIConnectionEvent',
  'MIDIAccess',
  'InputDeviceInfo',
  'ImageCapture',
  'ImageBitmapRenderingContext',
  'IIRFilterNode',
  'IDBVersionChangeEvent',
  'IDBTransaction',
  'IDBRequest',
  'IDBOpenDBRequest',
  'IDBObjectStore',
  'IDBKeyRange',
  'IDBIndex',
  'IDBFactory',
  'IDBDatabase',
  'IDBCursorWithValue',
  'IDBCursor',
  'GamepadEvent',
  'Gamepad',
  'GamepadButton',
  'GainNode',
  'EventSource',
  'DynamicsCompressorNode',
  'DeviceOrientationEvent',
  'DeviceMotionEvent',
  'DelayNode',
  'DOMError',
  'CryptoKey',
  'Crypto',
  'ConvolverNode',
  'ConstantSourceNode',
  'CloseEvent',
  'ChannelSplitterNode',
  'ChannelMergerNode',
  'CanvasRenderingContext2D',
  'CanvasCaptureMediaStreamTrack',
  'BroadcastChannel',
  'BlobEvent',
  'BiquadFilterNode',
  'BeforeInstallPromptEvent',
  'BatteryManager',
  'BaseAudioContext',
  'AudioWorkletNode',
  'AudioScheduledSourceNode',
  'AudioProcessingEvent',
  'AudioParamMap',
  'AudioParam',
  'AudioNode',
  'AudioListener',
  'AudioDestinationNode',
  'AudioContext',
  'AudioBufferSourceNode',
  'AudioBuffer',
  'AnalyserNode',
  'XPathResult',
  'XPathExpression',
  'XPathEvaluator',
  'XMLSerializer',
  'XMLHttpRequestUpload',
  'XMLHttpRequestEventTarget',
  'XMLHttpRequest',
  'XMLDocument',
  'Window',
  'WheelEvent',
  'VisualViewport',
  'ValidityState',
  'VTTCue',
  'URLSearchParams',
  'URL',
  'UIEvent',
  'TreeWalker',
  'TransitionEvent',
  'TrackEvent',
  'TouchList',
  'TouchEvent',
  'Touch',
  'TimeRanges',
  'TextTrackList',
  'TextTrackCueList',
  'TextTrackCue',
  'TextTrack',
  'TextMetrics',
  'TextEvent',
  'Text',
  'TaskAttributionTiming',
  'StyleSheetList',
  'StyleSheet',
  'StylePropertyMapReadOnly',
  'StylePropertyMap',
  'StaticRange',
  'ShadowRoot',
  'Selection',
  'SecurityPolicyViolationEvent',
  'Screen',
  'SVGViewElement',
  'SVGUseElement',
  'SVGUnitTypes',
  'SVGTransformList',
  'SVGTransform',
  'SVGTitleElement',
  'SVGTextPositioningElement',
  'SVGTextPathElement',
  'SVGTextElement',
  'SVGTextContentElement',
  'SVGTSpanElement',
  'SVGSymbolElement',
  'SVGSwitchElement',
  'SVGStyleElement',
  'SVGStringList',
  'SVGStopElement',
  'SVGSetElement',
  'SVGScriptElement',
  'SVGSVGElement',
  'SVGRectElement',
  'SVGRect',
  'SVGRadialGradientElement',
  'SVGPreserveAspectRatio',
  'SVGPolylineElement',
  'SVGPolygonElement',
  'SVGPointList',
  'SVGPoint',
  'SVGPatternElement',
  'SVGPathElement',
  'SVGNumberList',
  'SVGNumber',
  'SVGMetadataElement',
  'SVGMatrix',
  'SVGMaskElement',
  'SVGMarkerElement',
  'SVGLinearGradientElement',
  'SVGLineElement',
  'SVGLengthList',
  'SVGLength',
  'SVGImageElement',
  'SVGGraphicsElement',
  'SVGGradientElement',
  'SVGGeometryElement',
  'SVGGElement',
  'SVGForeignObjectElement',
  'SVGFilterElement',
  'SVGFETurbulenceElement',
  'SVGFETileElement',
  'SVGFESpotLightElement',
  'SVGFESpecularLightingElement',
  'SVGFEPointLightElement',
  'SVGFEOffsetElement',
  'SVGFEMorphologyElement',
  'SVGFEMergeNodeElement',
  'SVGFEMergeElement',
  'SVGFEImageElement',
  'SVGFEGaussianBlurElement',
  'SVGFEFuncRElement',
  'SVGFEFuncGElement',
  'SVGFEFuncBElement',
  'SVGFEFuncAElement',
  'SVGFEFloodElement',
  'SVGFEDropShadowElement',
  'SVGFEDistantLightElement',
  'SVGFEDisplacementMapElement',
  'SVGFEDiffuseLightingElement',
  'SVGFEConvolveMatrixElement',
  'SVGFECompositeElement',
  'SVGFEComponentTransferElement',
  'SVGFEColorMatrixElement',
  'SVGFEBlendElement',
  'SVGEllipseElement',
  'SVGElement',
  'SVGDescElement',
  'SVGDefsElement',
  'SVGComponentTransferFunctionElement',
  'SVGClipPathElement',
  'SVGCircleElement',
  'SVGAnimatedTransformList',
  'SVGAnimatedString',
  'SVGAnimatedRect',
  'SVGAnimatedPreserveAspectRatio',
  'SVGAnimatedNumberList',
  'SVGAnimatedNumber',
  'SVGAnimatedLengthList',
  'SVGAnimatedLength',
  'SVGAnimatedInteger',
  'SVGAnimatedEnumeration',
  'SVGAnimatedBoolean',
  'SVGAnimatedAngle',
  'SVGAnimateTransformElement',
  'SVGAnimateMotionElement',
  'SVGAnimateElement',
  'SVGAngle',
  'SVGAElement',
  'Response',
  'ResizeObserverEntry',
  'ResizeObserver',
  'Request',
  'Range',
  'RadioNodeList',
  'PromiseRejectionEvent',
  'ProgressEvent',
  'ProcessingInstruction',
  'PopStateEvent',
  'PointerEvent',
  'PerformanceTiming',
  'PerformanceServerTiming',
  'PerformanceResourceTiming',
  'PerformancePaintTiming',
  'PerformanceObserverEntryList',
  'PerformanceObserver',
  'PerformanceNavigation',
  'PerformanceMeasure',
  'PerformanceMark',
  'PerformanceLongTaskTiming',
  'PerformanceEntry',
  'Performance',
  'PageTransitionEvent',
  'NodeList',
  'NodeIterator',
  'NodeFilter',
  'Node',
  'Navigator',
  'NamedNodeMap',
  'MutationRecord',
  'MutationObserver',
  'MutationEvent',
  'MouseEvent',
  'MessagePort',
  'MessageEvent',
  'MessageChannel',
  'MediaQueryListEvent',
  'MediaQueryList',
  'MediaList',
  'MediaError',
  'Location',
  'KeyboardEvent',
  'IntersectionObserverEntry',
  'IntersectionObserver',
  'InputEvent',
  'InputDeviceCapabilities',
  'ImageData',
  'ImageBitmap',
  'IdleDeadline',
  'History',
  'Headers',
  'HashChangeEvent',
  'HTMLVideoElement',
  'HTMLUnknownElement',
  'HTMLUListElement',
  'HTMLTrackElement',
  'HTMLTitleElement',
  'HTMLTimeElement',
  'HTMLTextAreaElement',
  'HTMLTemplateElement',
  'HTMLTableSectionElement',
  'HTMLTableRowElement',
  'HTMLTableElement',
  'HTMLTableColElement',
  'HTMLTableCellElement',
  'HTMLTableCaptionElement',
  'HTMLStyleElement',
  'HTMLSpanElement',
  'HTMLSourceElement',
  'HTMLSlotElement',
  'HTMLShadowElement',
  'HTMLSelectElement',
  'HTMLScriptElement',
  'HTMLQuoteElement',
  'HTMLProgressElement',
  'HTMLPreElement',
  'HTMLPictureElement',
  'HTMLParamElement',
  'HTMLParagraphElement',
  'HTMLOutputElement',
  'HTMLOptionsCollection',
  'Option',
  'HTMLOptionElement',
  'HTMLOptGroupElement',
  'HTMLObjectElement',
  'HTMLOListElement',
  'HTMLModElement',
  'HTMLMeterElement',
  'HTMLMetaElement',
  'HTMLMenuElement',
  'HTMLMediaElement',
  'HTMLMarqueeElement',
  'HTMLMapElement',
  'HTMLLinkElement',
  'HTMLLegendElement',
  'HTMLLabelElement',
  'HTMLLIElement',
  'HTMLInputElement',
  'Image',
  'HTMLImageElement',
  'HTMLIFrameElement',
  'HTMLHtmlElement',
  'HTMLHeadingElement',
  'HTMLHeadElement',
  'HTMLHRElement',
  'HTMLFrameSetElement',
  'HTMLFrameElement',
  'HTMLFormElement',
  'HTMLFormControlsCollection',
  'HTMLFontElement',
  'HTMLFieldSetElement',
  'HTMLEmbedElement',
  'HTMLElement',
  'HTMLDocument',
  'HTMLDivElement',
  'HTMLDirectoryElement',
  'HTMLDialogElement',
  'HTMLDetailsElement',
  'HTMLDataListElement',
  'HTMLDataElement',
  'HTMLDListElement',
  'HTMLContentElement',
  'HTMLCollection',
  'HTMLCanvasElement',
  'HTMLButtonElement',
  'HTMLBodyElement',
  'HTMLBaseElement',
  'HTMLBRElement',
  'Audio',
  'HTMLAudioElement',
  'HTMLAreaElement',
  'HTMLAnchorElement',
  'HTMLAllCollection',
  'FormData',
  'FontFaceSetLoadEvent',
  'FocusEvent',
  'FileReader',
  'FileList',
  'File',
  'EventTarget',
  'Event',
  'ErrorEvent',
  'Element',
  'DragEvent',
  'DocumentType',
  'DocumentFragment',
  'Document',
  'DataTransferItemList',
  'DataTransferItem',
  'DataTransfer',
  'DOMTokenList',
  'DOMStringMap',
  'DOMStringList',
  'DOMRectReadOnly',
  'DOMRectList',
  'DOMRect',
  'DOMQuad',
  'DOMPointReadOnly',
  'DOMPoint',
  'DOMParser',
  'DOMMatrixReadOnly',
  'DOMMatrix',
  'DOMImplementation',
  'DOMException',
  'CustomEvent',
  'CustomElementRegistry',
  'CompositionEvent',
  'Comment',
  'ClipboardEvent',
  'CharacterData',
  'CSSVariableReferenceValue',
  'CSSUnparsedValue',
  'CSSUnitValue',
  'CSSTranslate',
  'CSSTransformValue',
  'CSSTransformComponent',
  'CSSSupportsRule',
  'CSSStyleValue',
  'CSSStyleSheet',
  'CSSStyleRule',
  'CSSStyleDeclaration',
  'CSSSkewY',
  'CSSSkewX',
  'CSSSkew',
  'CSSScale',
  'CSSRuleList',
  'CSSRule',
  'CSSRotate',
  'CSSPositionValue',
  'CSSPerspective',
  'CSSPageRule',
  'CSSNumericValue',
  'CSSNumericArray',
  'CSSNamespaceRule',
  'CSSMediaRule',
  'CSSMatrixComponent',
  'CSSMathValue',
  'CSSMathSum',
  'CSSMathProduct',
  'CSSMathNegate',
  'CSSMathMin',
  'CSSMathMax',
  'CSSMathInvert',
  'CSSKeywordValue',
  'CSSKeyframesRule',
  'CSSKeyframeRule',
  'CSSImportRule',
  'CSSImageValue',
  'CSSGroupingRule',
  'CSSFontFaceRule',
  'CSS',
  'CSSConditionRule',
  'CDATASection',
  'Blob',
  'BeforeUnloadEvent',
  'BarProp',
  'Attr',
  'AnimationEvent',
  'AbortSignal',
  'AbortController',
  'WebKitCSSMatrix',
  'WebKitMutationObserver',
  'WebKitAnimationEvent',
  'WebKitTransitionEvent',
  'SharedArrayBuffer',
  'Atomics',
  'BigInt',
  'WebAssembly',
  'MediaCapabilitiesInfo',
  'OffscreenCanvas',
  'PerformanceNavigationTiming',
  'ReportingObserver',
  'SVGAnimationElement',
  'SVGDiscardElement',
  'SVGMPathElement',
  'SharedWorker',
  'FontFace',
  'Worker',
  'XSLTProcessor',
  'GamepadHapticActuator',
  'Notification',
  'OffscreenCanvasRenderingContext2D',
  'PaymentInstruments',
  'PaymentManager',
  'PaymentRequestUpdateEvent',
  'Permissions',
  'PermissionStatus',
  'EnterPictureInPictureEvent',
  'PictureInPictureWindow',
  'Presentation',
  'PresentationAvailability',
  'PresentationConnection',
  'PresentationConnectionAvailableEvent',
  'PresentationConnectionCloseEvent',
  'PresentationConnectionList',
  'PresentationReceiver',
  'PresentationRequest',
  'PushManager',
  'PushSubscription',
  'PushSubscriptionOptions',
  'RemotePlayback',
  'SpeechSynthesisEvent',
  'SpeechSynthesisUtterance',
  'CanvasGradient',
  'CanvasPattern',
  'Path2D',
  'WebGL2RenderingContext',
  'WebGLActiveInfo',
  'WebGLBuffer',
  'WebGLFramebuffer',
  'WebGLProgram',
  'WebGLQuery',
  'WebGLRenderbuffer',
  'WebGLRenderingContext',
  'WebGLSampler',
  'WebGLShader',
  'WebGLShaderPrecisionFormat',
  'WebGLSync',
  'WebGLTexture',
  'WebGLTransformFeedback',
  'WebGLUniformLocation',
  'WebGLVertexArrayObject',
  'BluetoothUUID',
  'Worklet',
  'ApplicationCache',
  'ApplicationCacheErrorEvent',
  'AudioWorklet',
  'Cache',
  'CacheStorage',
  'Clipboard',
  'Credential',
  'CredentialsContainer',
  'FederatedCredential',
  'Keyboard',
  'MediaKeyMessageEvent',
  'MediaKeys',
  'MediaKeySession',
  'MediaKeyStatusMap',
  'MediaKeySystemAccess',
  'NavigationPreloadManager',
  'PasswordCredential',
  'ServiceWorker',
  'ServiceWorkerContainer',
  'ServiceWorkerRegistration',
  'StorageManager',
  'KeyboardLayoutMap',
  'PaymentAddress',
  'PaymentRequest',
  'PaymentResponse',
  'AbsoluteOrientationSensor',
  'Accelerometer',
  'Gyroscope',
  'LinearAccelerationSensor',
  'OrientationSensor',
  'RelativeOrientationSensor',
  'Sensor',
  'SensorErrorEvent',
  'AuthenticatorAssertionResponse',
  'AuthenticatorAttestationResponse',
  'AuthenticatorResponse',
  'PublicKeyCredential',
  'Bluetooth',
  'BluetoothCharacteristicProperties',
  'BluetoothDevice',
  'BluetoothRemoteGATTCharacteristic',
  'BluetoothRemoteGATTDescriptor',
  'BluetoothRemoteGATTServer',
  'BluetoothRemoteGATTService',
  'Lock',
  'LockManager',
  'USB',
  'USBAlternateInterface',
  'USBConfiguration',
  'USBConnectionEvent',
  'USBDevice',
  'USBEndpoint',
  'USBInterface',
  'USBInTransferResult',
  'USBIsochronousInTransferPacket',
  'USBIsochronousInTransferResult',
  'USBIsochronousOutTransferPacket',
  'USBIsochronousOutTransferResult',
  'USBOutTransferResult',
  'DoodleNotifier',
])

export default builtinClasses

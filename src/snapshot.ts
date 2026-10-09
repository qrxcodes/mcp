// The hosted server's public catalogue, taken from tools/list on https://qrx.codes/mcp on 2026-10-09.
// Used only when the remote refuses an unauthenticated connection and the server card cannot be read.
import type { Implementation, Tool } from '@modelcontextprotocol/sdk/types.js';

const snapshot = {
  "serverInfo": {
    "name": "qrx",
    "title": "QRX",
    "version": "1.0.0",
    "websiteUrl": "https://qrx.codes",
    "icons": [
      {
        "src": "https://qrx.codes/images/brand/qrx-code-512.png",
        "mimeType": "image/png",
        "sizes": [
          "512x512"
        ]
      },
      {
        "src": "https://qrx.codes/images/brand/qrx-mark.svg",
        "mimeType": "image/svg+xml",
        "sizes": [
          "any"
        ]
      }
    ]
  },
  "instructions": "QRX makes artistic QR codes: a scannable code painted into a picture from a description. To make one, call generate_qr_code with a prompt and a destination link, then call get_qr_code with the returned id until its status is succeeded (this usually takes under a minute). Codes count against the user's QRX allowance; call get_account to see what is left.",
  "tools": [
    {
      "name": "generate_qr_code",
      "title": "Generate a QR code",
      "icons": [
        {
          "src": "https://qrx.codes/images/brand/qrx-code-512.png",
          "mimeType": "image/png",
          "sizes": [
            "512x512"
          ]
        },
        {
          "src": "https://qrx.codes/images/brand/qrx-mark.svg",
          "mimeType": "image/svg+xml",
          "sizes": [
            "any"
          ]
        }
      ],
      "description": "Use this when the user wants a new QR code that is also a picture: a scannable code painted into art from a description, that opens a link (or joins a Wi-Fi network, if the account’s plan includes Wi-Fi codes). It starts the code and answers at once with its id while the picture is painted, which usually takes under a minute; then call get_qr_code with the id to wait for the image. Do not use it to look at, list or change codes that already exist. Each code counts against the user’s QRX allowance.",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "prompt"
        ],
        "properties": {
          "prompt": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000,
            "description": "What the picture should show, e.g. \"a lighthouse on a cliff at sunset\"."
          },
          "destination": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2048,
            "format": "iri",
            "pattern": "^[Hh][Tt][Tt][Pp][Ss]?://[^\\s\\\\]+$",
            "description": "The link scans open: an absolute http or https URL, e.g. https://example.com/menu. Give this or wifi."
          },
          "wifi": {
            "type": "object",
            "description": "The Wi-Fi network the code joins. Give this or destination.",
            "additionalProperties": false,
            "required": [
              "ssid",
              "password"
            ],
            "properties": {
              "ssid": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32,
                "description": "The network’s name."
              },
              "password": {
                "type": "string",
                "minLength": 1,
                "maxLength": 63
              },
              "security": {
                "type": "string",
                "enum": [
                  "wpa",
                  "wep"
                ],
                "default": "wpa",
                "description": "`wpa` or `wep`. `nopass`, for open networks, is planned."
              }
            }
          },
          "style": {
            "type": "string",
            "description": "A style id from list_styles. Leave out for the default."
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": [
          "id",
          "object",
          "status",
          "type",
          "prompt",
          "style",
          "destination",
          "wifi",
          "shortUrl",
          "imageUrl",
          "pageUrl",
          "error",
          "createdAt"
        ],
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 64,
            "description": "The code’s id. A link code’s id is also the path of its short link: lowercase letters and digits, currently 6 characters. A Wi-Fi code’s id is a UUID. Treat every id as an opaque, case-sensitive string of up to 64 characters. It never changes."
          },
          "object": {
            "const": "code"
          },
          "status": {
            "type": "string",
            "x-extensible-enum": [
              "queued",
              "processing",
              "succeeded",
              "failed"
            ],
            "examples": [
              "queued",
              "processing",
              "succeeded",
              "failed"
            ],
            "description": "`processing` until the picture is painted and checked to scan; then `succeeded` or `failed`. `queued` is reserved for a code waiting to start. More values may be added: treat anything other than `succeeded` or `failed` as still in progress."
          },
          "type": {
            "type": "string",
            "x-extensible-enum": [
              "url",
              "wifi"
            ],
            "examples": [
              "url",
              "wifi"
            ],
            "description": "`url` for a link code, `wifi` for a Wi-Fi code. More values may be added."
          },
          "prompt": {
            "type": "string"
          },
          "style": {
            "type": [
              "string",
              "null"
            ],
            "description": "The style id, if one was chosen."
          },
          "destination": {
            "type": [
              "string",
              "null"
            ],
            "description": "Where a link code’s scans go; null for a Wi-Fi code."
          },
          "wifi": {
            "type": [
              "object",
              "null"
            ],
            "description": "The network a Wi-Fi code joins; null for a link code. The password is never returned.",
            "required": [
              "ssid",
              "security"
            ],
            "properties": {
              "ssid": {
                "type": "string"
              },
              "security": {
                "type": "string",
                "x-extensible-enum": [
                  "wpa",
                  "wep"
                ],
                "examples": [
                  "wpa",
                  "wep"
                ],
                "description": "More values (such as `nopass`) may be added."
              }
            }
          },
          "shortUrl": {
            "type": [
              "string",
              "null"
            ],
            "description": "The link the code encodes (`https://qrx.to/<id>`); scans go through it to `destination`. Null for a Wi-Fi code."
          },
          "imageUrl": {
            "type": [
              "string",
              "null"
            ],
            "description": "The finished image (PNG), once the code has succeeded."
          },
          "pageUrl": {
            "type": "string",
            "description": "The code’s page in the app."
          },
          "error": {
            "type": [
              "object",
              "null"
            ],
            "required": [
              "message"
            ],
            "properties": {
              "message": {
                "type": "string"
              }
            },
            "description": "Why the code failed, when it did."
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "annotations": {
        "title": "Generate a QR code",
        "readOnlyHint": false,
        "destructiveHint": false,
        "idempotentHint": false,
        "openWorldHint": false
      },
      "securitySchemes": [
        {
          "type": "oauth2",
          "scopes": [
            "qrx:generate"
          ]
        }
      ],
      "_meta": {
        "ui": {
          "resourceUri": "ui://qrx/code-v1.html",
          "visibility": [
            "model",
            "app"
          ]
        },
        "ui/resourceUri": "ui://qrx/code-v1.html",
        "openai/outputTemplate": "ui://qrx/code-v1.html",
        "openai/toolInvocation/invoking": "Designing your QR code…",
        "openai/toolInvocation/invoked": "QR code started",
        "securitySchemes": [
          {
            "type": "oauth2",
            "scopes": [
              "qrx:generate"
            ]
          }
        ]
      }
    },
    {
      "name": "get_qr_code",
      "title": "Get a QR code",
      "description": "Use this when you have a QR code’s id (from generate_qr_code or list_qr_codes) and need its status or finished image. While the code is still being painted it waits up to `wait` seconds (25 by default) for it to finish before answering, so call it again if it is still processing. Do not use it to make a new code.",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id"
        ],
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 64,
            "description": "The code’s id."
          },
          "wait": {
            "type": "integer",
            "minimum": 0,
            "maximum": 25,
            "default": 25,
            "description": "Seconds to wait for a processing code to finish before answering, 0 to 25."
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": [
          "id",
          "object",
          "status",
          "type",
          "prompt",
          "style",
          "destination",
          "wifi",
          "shortUrl",
          "imageUrl",
          "pageUrl",
          "error",
          "createdAt"
        ],
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 64,
            "description": "The code’s id. A link code’s id is also the path of its short link: lowercase letters and digits, currently 6 characters. A Wi-Fi code’s id is a UUID. Treat every id as an opaque, case-sensitive string of up to 64 characters. It never changes."
          },
          "object": {
            "const": "code"
          },
          "status": {
            "type": "string",
            "x-extensible-enum": [
              "queued",
              "processing",
              "succeeded",
              "failed"
            ],
            "examples": [
              "queued",
              "processing",
              "succeeded",
              "failed"
            ],
            "description": "`processing` until the picture is painted and checked to scan; then `succeeded` or `failed`. `queued` is reserved for a code waiting to start. More values may be added: treat anything other than `succeeded` or `failed` as still in progress."
          },
          "type": {
            "type": "string",
            "x-extensible-enum": [
              "url",
              "wifi"
            ],
            "examples": [
              "url",
              "wifi"
            ],
            "description": "`url` for a link code, `wifi` for a Wi-Fi code. More values may be added."
          },
          "prompt": {
            "type": "string"
          },
          "style": {
            "type": [
              "string",
              "null"
            ],
            "description": "The style id, if one was chosen."
          },
          "destination": {
            "type": [
              "string",
              "null"
            ],
            "description": "Where a link code’s scans go; null for a Wi-Fi code."
          },
          "wifi": {
            "type": [
              "object",
              "null"
            ],
            "description": "The network a Wi-Fi code joins; null for a link code. The password is never returned.",
            "required": [
              "ssid",
              "security"
            ],
            "properties": {
              "ssid": {
                "type": "string"
              },
              "security": {
                "type": "string",
                "x-extensible-enum": [
                  "wpa",
                  "wep"
                ],
                "examples": [
                  "wpa",
                  "wep"
                ],
                "description": "More values (such as `nopass`) may be added."
              }
            }
          },
          "shortUrl": {
            "type": [
              "string",
              "null"
            ],
            "description": "The link the code encodes (`https://qrx.to/<id>`); scans go through it to `destination`. Null for a Wi-Fi code."
          },
          "imageUrl": {
            "type": [
              "string",
              "null"
            ],
            "description": "The finished image (PNG), once the code has succeeded."
          },
          "pageUrl": {
            "type": "string",
            "description": "The code’s page in the app."
          },
          "error": {
            "type": [
              "object",
              "null"
            ],
            "required": [
              "message"
            ],
            "properties": {
              "message": {
                "type": "string"
              }
            },
            "description": "Why the code failed, when it did."
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "annotations": {
        "title": "Get a QR code",
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": false
      },
      "securitySchemes": [
        {
          "type": "oauth2",
          "scopes": [
            "qrx:read"
          ]
        }
      ],
      "_meta": {
        "ui": {
          "resourceUri": "ui://qrx/code-v1.html",
          "visibility": [
            "model",
            "app"
          ]
        },
        "ui/resourceUri": "ui://qrx/code-v1.html",
        "openai/outputTemplate": "ui://qrx/code-v1.html",
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Checking your QR code…",
        "openai/toolInvocation/invoked": "Checked the QR code",
        "securitySchemes": [
          {
            "type": "oauth2",
            "scopes": [
              "qrx:read"
            ]
          }
        ]
      }
    },
    {
      "name": "list_qr_codes",
      "title": "List QR codes",
      "description": "Use this when the user asks about QR codes they already have, newest first, a page at a time (pass nextCursor as cursor for the next page). Do not use it to make a code.",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 100,
            "default": 20,
            "description": "How many codes to return, 1 to 100."
          },
          "cursor": {
            "type": "string",
            "description": "nextCursor from the previous page."
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": [
          "object",
          "data",
          "hasMore",
          "nextCursor"
        ],
        "properties": {
          "object": {
            "const": "list"
          },
          "data": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "id",
                "object",
                "status",
                "type",
                "prompt",
                "style",
                "destination",
                "wifi",
                "shortUrl",
                "imageUrl",
                "pageUrl",
                "error",
                "createdAt"
              ],
              "properties": {
                "id": {
                  "type": "string",
                  "maxLength": 64,
                  "description": "The code’s id. A link code’s id is also the path of its short link: lowercase letters and digits, currently 6 characters. A Wi-Fi code’s id is a UUID. Treat every id as an opaque, case-sensitive string of up to 64 characters. It never changes."
                },
                "object": {
                  "const": "code"
                },
                "status": {
                  "type": "string",
                  "x-extensible-enum": [
                    "queued",
                    "processing",
                    "succeeded",
                    "failed"
                  ],
                  "examples": [
                    "queued",
                    "processing",
                    "succeeded",
                    "failed"
                  ],
                  "description": "`processing` until the picture is painted and checked to scan; then `succeeded` or `failed`. `queued` is reserved for a code waiting to start. More values may be added: treat anything other than `succeeded` or `failed` as still in progress."
                },
                "type": {
                  "type": "string",
                  "x-extensible-enum": [
                    "url",
                    "wifi"
                  ],
                  "examples": [
                    "url",
                    "wifi"
                  ],
                  "description": "`url` for a link code, `wifi` for a Wi-Fi code. More values may be added."
                },
                "prompt": {
                  "type": "string"
                },
                "style": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "description": "The style id, if one was chosen."
                },
                "destination": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "description": "Where a link code’s scans go; null for a Wi-Fi code."
                },
                "wifi": {
                  "type": [
                    "object",
                    "null"
                  ],
                  "description": "The network a Wi-Fi code joins; null for a link code. The password is never returned.",
                  "required": [
                    "ssid",
                    "security"
                  ],
                  "properties": {
                    "ssid": {
                      "type": "string"
                    },
                    "security": {
                      "type": "string",
                      "x-extensible-enum": [
                        "wpa",
                        "wep"
                      ],
                      "examples": [
                        "wpa",
                        "wep"
                      ],
                      "description": "More values (such as `nopass`) may be added."
                    }
                  }
                },
                "shortUrl": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "description": "The link the code encodes (`https://qrx.to/<id>`); scans go through it to `destination`. Null for a Wi-Fi code."
                },
                "imageUrl": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "description": "The finished image (PNG), once the code has succeeded."
                },
                "pageUrl": {
                  "type": "string",
                  "description": "The code’s page in the app."
                },
                "error": {
                  "type": [
                    "object",
                    "null"
                  ],
                  "required": [
                    "message"
                  ],
                  "properties": {
                    "message": {
                      "type": "string"
                    }
                  },
                  "description": "Why the code failed, when it did."
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                }
              }
            }
          },
          "hasMore": {
            "type": "boolean"
          },
          "nextCursor": {
            "type": [
              "string",
              "null"
            ],
            "description": "Pass as `cursor` for the next page; null on the last page."
          }
        }
      },
      "annotations": {
        "title": "List QR codes",
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": false
      },
      "securitySchemes": [
        {
          "type": "oauth2",
          "scopes": [
            "qrx:read"
          ]
        }
      ],
      "_meta": {
        "securitySchemes": [
          {
            "type": "oauth2",
            "scopes": [
              "qrx:read"
            ]
          }
        ]
      }
    },
    {
      "name": "change_qr_code_destination",
      "title": "Change where a QR code points",
      "description": "Use this when the user wants an existing link QR code to open a different web address. Printed copies follow at once. It only works for link codes, and only if the account’s plan allows changing destinations. Do not use it to make a new code.",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "destination"
        ],
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 64,
            "description": "The code’s id."
          },
          "destination": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2048,
            "format": "iri",
            "pattern": "^[Hh][Tt][Tt][Pp][Ss]?://[^\\s\\\\]+$",
            "description": "The new link scans should open: an absolute http or https URL."
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": [
          "id",
          "object",
          "status",
          "type",
          "prompt",
          "style",
          "destination",
          "wifi",
          "shortUrl",
          "imageUrl",
          "pageUrl",
          "error",
          "createdAt"
        ],
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 64,
            "description": "The code’s id. A link code’s id is also the path of its short link: lowercase letters and digits, currently 6 characters. A Wi-Fi code’s id is a UUID. Treat every id as an opaque, case-sensitive string of up to 64 characters. It never changes."
          },
          "object": {
            "const": "code"
          },
          "status": {
            "type": "string",
            "x-extensible-enum": [
              "queued",
              "processing",
              "succeeded",
              "failed"
            ],
            "examples": [
              "queued",
              "processing",
              "succeeded",
              "failed"
            ],
            "description": "`processing` until the picture is painted and checked to scan; then `succeeded` or `failed`. `queued` is reserved for a code waiting to start. More values may be added: treat anything other than `succeeded` or `failed` as still in progress."
          },
          "type": {
            "type": "string",
            "x-extensible-enum": [
              "url",
              "wifi"
            ],
            "examples": [
              "url",
              "wifi"
            ],
            "description": "`url` for a link code, `wifi` for a Wi-Fi code. More values may be added."
          },
          "prompt": {
            "type": "string"
          },
          "style": {
            "type": [
              "string",
              "null"
            ],
            "description": "The style id, if one was chosen."
          },
          "destination": {
            "type": [
              "string",
              "null"
            ],
            "description": "Where a link code’s scans go; null for a Wi-Fi code."
          },
          "wifi": {
            "type": [
              "object",
              "null"
            ],
            "description": "The network a Wi-Fi code joins; null for a link code. The password is never returned.",
            "required": [
              "ssid",
              "security"
            ],
            "properties": {
              "ssid": {
                "type": "string"
              },
              "security": {
                "type": "string",
                "x-extensible-enum": [
                  "wpa",
                  "wep"
                ],
                "examples": [
                  "wpa",
                  "wep"
                ],
                "description": "More values (such as `nopass`) may be added."
              }
            }
          },
          "shortUrl": {
            "type": [
              "string",
              "null"
            ],
            "description": "The link the code encodes (`https://qrx.to/<id>`); scans go through it to `destination`. Null for a Wi-Fi code."
          },
          "imageUrl": {
            "type": [
              "string",
              "null"
            ],
            "description": "The finished image (PNG), once the code has succeeded."
          },
          "pageUrl": {
            "type": "string",
            "description": "The code’s page in the app."
          },
          "error": {
            "type": [
              "object",
              "null"
            ],
            "required": [
              "message"
            ],
            "properties": {
              "message": {
                "type": "string"
              }
            },
            "description": "Why the code failed, when it did."
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "annotations": {
        "title": "Change where a QR code points",
        "readOnlyHint": false,
        "destructiveHint": true,
        "idempotentHint": true,
        "openWorldHint": false
      },
      "securitySchemes": [
        {
          "type": "oauth2",
          "scopes": [
            "qrx:generate"
          ]
        }
      ],
      "_meta": {
        "securitySchemes": [
          {
            "type": "oauth2",
            "scopes": [
              "qrx:generate"
            ]
          }
        ]
      }
    },
    {
      "name": "get_account",
      "title": "Get plan and usage",
      "description": "Use this when the user asks how many QR codes they can still make today, when the daily count resets, or what their QRX account can do. Do not use it to make or list codes.",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {}
      },
      "outputSchema": {
        "type": "object",
        "required": [
          "object",
          "plan",
          "codes",
          "features",
          "rateLimits",
          "credentials"
        ],
        "properties": {
          "object": {
            "const": "account"
          },
          "plan": {
            "type": "string",
            "x-extensible-enum": [
              "free",
              "starter"
            ],
            "examples": [
              "free",
              "starter"
            ],
            "description": "What the account pays for. `features` says what it can do today, and the two can differ (for QRX staff, say), so act on `features`. More values may be added."
          },
          "codes": {
            "type": "object",
            "required": [
              "dailyLimit",
              "remainingToday",
              "resetsAt"
            ],
            "description": "The daily allowance. All null when the account has no daily limit.",
            "properties": {
              "dailyLimit": {
                "type": [
                  "integer",
                  "null"
                ]
              },
              "remainingToday": {
                "type": [
                  "integer",
                  "null"
                ]
              },
              "resetsAt": {
                "type": [
                  "string",
                  "null"
                ],
                "format": "date-time"
              }
            }
          },
          "features": {
            "type": "object",
            "required": [
              "wifiCodes",
              "changeDestination"
            ],
            "properties": {
              "wifiCodes": {
                "type": "boolean"
              },
              "changeDestination": {
                "type": "boolean"
              }
            }
          },
          "rateLimits": {
            "type": "object",
            "required": [
              "requests",
              "codes"
            ],
            "properties": {
              "requests": {
                "type": "object",
                "required": [
                  "limit",
                  "windowSeconds"
                ],
                "properties": {
                  "limit": {
                    "type": "integer"
                  },
                  "windowSeconds": {
                    "type": "integer"
                  }
                }
              },
              "codes": {
                "type": "object",
                "required": [
                  "limit",
                  "windowSeconds"
                ],
                "properties": {
                  "limit": {
                    "type": "integer"
                  },
                  "windowSeconds": {
                    "type": "integer"
                  }
                }
              }
            }
          },
          "credentials": {
            "type": "object",
            "required": [
              "type",
              "prefix",
              "environment"
            ],
            "properties": {
              "type": {
                "type": "string",
                "x-extensible-enum": [
                  "api_key",
                  "oauth"
                ],
                "examples": [
                  "api_key",
                  "oauth"
                ],
                "description": "More values may be added."
              },
              "prefix": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "The start of the API key, enough to tell keys apart."
              },
              "environment": {
                "type": "string",
                "x-extensible-enum": [
                  "test",
                  "live"
                ],
                "examples": [
                  "test",
                  "live"
                ],
                "description": "The QRX site the credentials work on: `live` on qrx.codes. More values may be added."
              }
            }
          }
        }
      },
      "annotations": {
        "title": "Get plan and usage",
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": false
      },
      "securitySchemes": [
        {
          "type": "oauth2",
          "scopes": [
            "qrx:read"
          ]
        }
      ],
      "_meta": {
        "securitySchemes": [
          {
            "type": "oauth2",
            "scopes": [
              "qrx:read"
            ]
          }
        ]
      }
    },
    {
      "name": "get_profile",
      "title": "Get the signed-in QRX account",
      "description": "Use this when you need to know which QRX account is connected, for example to confirm it with the user. Do not use it for limits; use get_account.",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {}
      },
      "outputSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "name",
          "email",
          "nickname"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "email": {
            "type": "string"
          },
          "nickname": {
            "type": "string"
          }
        }
      },
      "annotations": {
        "title": "Get the signed-in QRX account",
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": false
      },
      "securitySchemes": [
        {
          "type": "oauth2",
          "scopes": [
            "qrx:read"
          ]
        }
      ],
      "_meta": {
        "openai/profile": true,
        "securitySchemes": [
          {
            "type": "oauth2",
            "scopes": [
              "qrx:read"
            ]
          }
        ]
      }
    },
    {
      "name": "list_styles",
      "title": "List QR code styles",
      "description": "Use this when the user wants to choose a look for a new QR code; pass a style id to generate_qr_code. Do not use it to make a code.",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {}
      },
      "outputSchema": {
        "type": "object",
        "required": [
          "object",
          "data",
          "hasMore",
          "nextCursor"
        ],
        "properties": {
          "object": {
            "const": "list"
          },
          "data": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "id",
                "object",
                "name",
                "previewUrl"
              ],
              "properties": {
                "id": {
                  "type": "string"
                },
                "object": {
                  "const": "style"
                },
                "name": {
                  "type": "string"
                },
                "previewUrl": {
                  "type": [
                    "string",
                    "null"
                  ],
                  "description": "A picture in the style."
                }
              }
            }
          },
          "hasMore": {
            "type": "boolean"
          },
          "nextCursor": {
            "type": "null"
          }
        }
      },
      "annotations": {
        "title": "List QR code styles",
        "readOnlyHint": true,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": false
      },
      "securitySchemes": [
        {
          "type": "noauth"
        }
      ],
      "_meta": {
        "securitySchemes": [
          {
            "type": "noauth"
          }
        ]
      }
    }
  ]
};

export const SNAPSHOT = snapshot as unknown as { serverInfo: Implementation; instructions: string; tools: Tool[] };

export const FALLBACK_RESOURCE_IMAGE = "/assets/images/silver.png"

function normalizeString(value) {
  if (typeof value === "string") return value.trim()
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

export function getResourceKey(item = {}) {
  const resourceId = normalizeString(item?.resourceId)
  if (resourceId) return `id:${resourceId}`

  const name = normalizeString(item?.resourceName || item?.name)
  if (name) return `name:${name.toLowerCase()}`

  return ""
}

export function resolveResourceImage({ imageUrl = "", fileName = "" } = {}) {
  const cleanImageUrl = normalizeString(imageUrl)
  if (cleanImageUrl) return cleanImageUrl

  const cleanFileName = normalizeString(fileName)
  if (!cleanFileName) return FALLBACK_RESOURCE_IMAGE
  if (/^https?:\/\//i.test(cleanFileName)) return cleanFileName

  return `/image/${encodeURIComponent(cleanFileName)}`
}

export function serializeResourceItem(item = {}, extra = {}) {
  const resourceId = normalizeString(item?.resourceId)
  const resourceName = normalizeString(item?.resourceName || item?.name)
  const fileName = normalizeString(item?.fileName)
  const imageUrl = normalizeString(item?.imageUrl)

  return {
    resourceId,
    resourceName,
    name: resourceName,
    fileName,
    imageUrl,
    image: resolveResourceImage({ imageUrl, fileName }),
    ...extra,
  }
}

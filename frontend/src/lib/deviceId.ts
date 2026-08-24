// A stable random id for this browser install, not this account -- lets
// staff_presence tell apart the same staff account logged in from two
// different computers (the normal case here, several people sharing one
// login) instead of a second device's heartbeat silently overwriting the
// first's row. Deliberately in localStorage, not sessionStorage: it should
// survive a tab close/reopen and identify "this browser", not "this tab".
const STORAGE_KEY = "datahub_device_id"

export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

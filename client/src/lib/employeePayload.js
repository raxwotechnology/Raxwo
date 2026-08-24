const OBJECT_ID_RE = /^[a-f\d]{24}$/i

/** Resolve document URLs from employee record (top-level fields + documents[] fallback). */
export function resolveEmployeeDocUrls(emp) {
  if (!emp) {
    return { cvUrl: '', agreementUrl: '', nicPhotoUrl: '', nicPhotoBackUrl: '' }
  }
  const fromDoc = (type) => {
    const doc = (emp.documents || []).find((d) => d.type === type)
    return (doc?.url || '').trim()
  }
  return {
    cvUrl: (emp.cvUrl || fromDoc('cv') || '').trim(),
    agreementUrl: (emp.agreementUrl || fromDoc('agreement') || '').trim(),
    nicPhotoUrl: (emp.nicPhotoUrl || fromDoc('nic_front') || '').trim(),
    nicPhotoBackUrl: (emp.nicPhotoBackUrl || fromDoc('nic_back') || '').trim(),
  }
}

function cleanObjectIdField(obj, key) {
  const v = obj[key]
  if (v === '' || v == null) {
    delete obj[key]
    return
  }
  if (typeof v === 'string' && !OBJECT_ID_RE.test(v)) delete obj[key]
}

function cleanDates(obj, keys) {
  if (!obj || typeof obj !== 'object') return
  for (const k of keys) {
    if (obj[k] === '' || obj[k] == null) delete obj[k]
  }
}

/**
 * Normalize employee create/update body so the API never receives invalid ObjectIds or date strings.
 */
export function buildEmployeeSavePayload(raw, { isEdit, fileUrls = {}, includeAllowances = true } = {}) {
  const d = { ...raw }

  delete d._id

  if (d.email && typeof d.email === 'string') {
    d.email = d.email.trim().toLowerCase()
  }

  if (isEdit) {
    delete d.password
    if (!includeAllowances) delete d.allowances
  }

  cleanObjectIdField(d, 'branch')
  cleanObjectIdField(d, 'manager')

  cleanDates(d, ['dob', 'resignationDate', 'joinedDate', 'probationEnd'])

  if (d.internship && typeof d.internship === 'object') {
    cleanDates(d.internship, ['startDate', 'endDate', 'convertedAt'])
    if (d.internship.durationWeeks === '' || Number.isNaN(Number(d.internship.durationWeeks))) {
      delete d.internship.durationWeeks
    }
  }

  if (d.contract && typeof d.contract === 'object') {
    cleanDates(d.contract, ['startDate', 'endDate', 'renewalDate'])
  }

  d.basicSalary = Number(d.basicSalary) || 0
  if (includeAllowances) d.allowances = Number(d.allowances) || 0

  d.epfEtfEnrolled = d.epfEtfEnrolled === true || d.epfEtfEnrolled === 'true' || d.epfEtfEnrolled === 'on'

  const emergencyContact = {
    name: d.emergencyContactName || '',
    phone: d.emergencyContactPhone || '',
    relationship: d.emergencyContactRelationship || '',
  }
  if (emergencyContact.name || emergencyContact.phone) {
    d.emergencyContact = emergencyContact
  } else {
    delete d.emergencyContact
  }
  delete d.emergencyContactName
  delete d.emergencyContactPhone
  delete d.emergencyContactRelationship

  Object.entries(fileUrls).forEach(([k, v]) => {
    if (v !== undefined && v !== null) d[k] = v
  })

  return d
}

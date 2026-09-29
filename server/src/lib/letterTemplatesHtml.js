/**
 * Professional HR letter bodies (HTML fragments).
 * Wrapped by client/server print shell with company letterhead.
 */

function esc(s) {
  if (s == null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function infoTable(rows) {
  const body = rows
    .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('');
  return `<table class="letter-info-table" cellpadding="0" cellspacing="0"><tbody>${body}</tbody></table>`;
}

function salaryRows(emp) {
  const gross = (Number(emp.basicSalary) || 0) + (Number(emp.allowances) || 0);
  return infoTable([
    ['Basic salary (LKR / month)', (emp.basicSalary || 0).toLocaleString('en-LK')],
    ['Allowances (LKR / month)', (emp.allowances || 0).toLocaleString('en-LK')],
    ['Gross remuneration (LKR / month)', gross.toLocaleString('en-LK')],
  ]);
}

function signatureBlock(issuedByName, titleLine) {
  return `
  <div class="letter-sig-wrap">
    <p class="letter-close">Yours faithfully,</p>
    <div class="letter-sig-space"></div>
    <p class="letter-sig-name">${esc(issuedByName)}</p>
    <p class="letter-sig-title">${esc(titleLine)}</p>
  </div>`;
}

const LETTER_HTML = {
  offer: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    const candidateName = emp?.userId?.name || data?.candidateName || data?.recipientName || 'Candidate';
    const designation = emp?.designation || data?.position || data?.designation || 'Specialist';
    const department = emp?.department || data?.department || '—';
    const branchName = emp?.branch?.name || data?.branch || 'Headquarters';
    const basicSalary = Number(emp?.basicSalary || data?.basicSalary || data?.offeredSalary || 0);
    const allowances = Number(emp?.allowances || data?.allowances || 0);
    const gross = basicSalary + allowances;

    const salaryTable = infoTable([
      ['Basic salary (LKR / month)', basicSalary.toLocaleString('en-LK')],
      ['Allowances (LKR / month)', allowances.toLocaleString('en-LK')],
      ['Gross remuneration (LKR / month)', gross.toLocaleString('en-LK')],
    ]);

    return `
<h1 class="letter-h1">Offer of Employment</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(candidateName)}</strong>,</p>
<p class="letter-p">We are pleased to offer you the position of <strong>${esc(designation)}</strong> in the <strong>${esc(department)}</strong> department at <strong>${esc(co.name)}</strong>, subject to the terms set out below.</p>
<h2 class="letter-h2">Position &amp; commencement</h2>
${infoTable([
      ['Position offered', designation],
      ['Department', department],
      ['Branch', branchName],
      ['Proposed start date', data?.startDate || 'To be confirmed'],
      ['Employment type', data?.employmentType || 'Full-time (permanent offer)'],
    ])}
<h2 class="letter-h2">Remuneration &amp; benefits</h2>
${salaryTable}
<p class="letter-p letter-small">Benefits shall be as per company policy applicable to your grade, including statutory contributions (EPF/ETF) where required.</p>
<h2 class="letter-h2">Joining instructions</h2>
<ol class="letter-ol">
  <li>Please confirm acceptance of this offer within <strong>7 calendar days</strong> of the date above.</li>
  <li>Complete pre-employment documentation and verification as directed by HR.</li>
  <li>Report to HR on the agreed commencement date with original identification documents.</li>
</ol>
<h2 class="letter-h2">Terms &amp; conditions</h2>
<p class="letter-p">This offer is subject to satisfactory background verification, valid work authorisation (if applicable), and execution of the company’s standard employment undertakings. Detailed terms of employment will be set out in your appointment documentation.</p>
${signatureBlock(data?.issuedByName, 'Human Resources')}
`;
  },

  appointment: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    const joined = emp.joinedDate ? new Date(emp.joinedDate).toLocaleDateString('en-LK') : 'As per agreement';
    const mgr = data.reportingManager || emp.manager?.name || 'Department Head';
    return `
<h1 class="letter-h1">Letter of Appointment</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(emp.userId?.name)}</strong>,</p>
<p class="letter-p">We are pleased to confirm your appointment as <strong>${esc(emp.designation)}</strong> at <strong>${esc(co.name)}</strong>, effective <strong>${esc(joined)}</strong>.</p>
<h2 class="letter-h2">Official appointment details</h2>
${infoTable([
      ['Employee ID', emp.employeeNo || '—'],
      ['Job role', emp.designation || '—'],
      ['Department', emp.department || '—'],
      ['Branch', emp.branch?.name || '—'],
      ['Reporting manager', mgr],
      ['EPF number', emp.epfNumber || 'Pending registration'],
    ])}
<h2 class="letter-h2">Working hours &amp; policies</h2>
<p class="letter-p">Standard working arrangements: <strong>${esc(data.workingHours || 'As per company policy and department schedule')}</strong>. You are required to comply with all company policies, including code of conduct, health &amp; safety, IT acceptable use, and confidentiality obligations.</p>
<h2 class="letter-h2">Remuneration</h2>
${salaryRows(emp)}
<p class="letter-p">Please complete any outstanding onboarding formalities with HR before your start date.</p>
${signatureBlock(data.issuedByName, 'Human Resources')}
`;
  },

  internship: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
<h1 class="letter-h1">Internship Confirmation</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(emp.userId?.name)}</strong>,</p>
<p class="letter-p">We are pleased to confirm your internship assignment with <strong>${esc(co.name)}</strong> in the <strong>${esc(emp.department || '—')}</strong> department.</p>
<h2 class="letter-h2">Internship programme</h2>
${infoTable([
      ['Supervisor / mentor', data.supervisor || emp.internship?.supervisorName || 'Department Head'],
      ['Start date', data.startDate || new Date().toLocaleDateString('en-LK')],
      ['End date', data.endDate || 'To be confirmed'],
      ['Duration', data.duration || 'As agreed'],
      ['Branch', emp.branch?.name || '—'],
    ])}
<h2 class="letter-h2">Learning objectives</h2>
<p class="letter-p">During the internship you will participate in departmental activities, supervised tasks, and knowledge-sharing sessions aligned with your academic or professional development goals.</p>
<h2 class="letter-h2">Stipend / allowance</h2>
<p class="letter-p">Where applicable, stipend: <strong>LKR ${(emp.basicSalary || 0).toLocaleString('en-LK')}</strong> per month (or as otherwise agreed in writing).</p>
<h2 class="letter-h2">Terms</h2>
<ol class="letter-ol">
  <li>This internship does not constitute an offer of permanent employment unless expressly confirmed in writing.</li>
  <li>Maintain confidentiality of company information and customer data at all times.</li>
  <li>A certificate of completion may be issued following satisfactory performance and clearance.</li>
</ol>
${signatureBlock(data.issuedByName, 'Human Resources')}
`;
  },

  contract: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
<h1 class="letter-h1">Contract Employment Letter</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(emp.userId?.name)}</strong>,</p>
<p class="letter-p">This letter confirms your engagement as a <strong>contract employee</strong> with <strong>${esc(co.name)}</strong> on the terms below.</p>
<h2 class="letter-h2">Contract period</h2>
${infoTable([
      ['Employee ID', emp.employeeNo || '—'],
      ['Role', emp.designation || '—'],
      ['Department', emp.department || '—'],
      ['Branch', emp.branch?.name || '—'],
      ['Contract start', data.startDate || d],
      ['Contract end', data.endDate || 'As per schedule'],
      ['Notice period', data.noticePeriod || '30 days'],
    ])}
<h2 class="letter-h2">Payment &amp; responsibilities</h2>
${salaryRows(emp)}
<p class="letter-p">You are responsible for deliverables assigned by your line manager, adherence to policies, and professional conduct throughout the contract term.</p>
<h2 class="letter-h2">Renewal &amp; conditions</h2>
<p class="letter-p">Renewal may be offered by mutual written agreement prior to contract expiry. Either party may terminate in accordance with the notice period above and applicable law.</p>
${signatureBlock(data.issuedByName, 'Human Resources')}
`;
  },

  part_time: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
<h1 class="letter-h1">Part-Time Employment Confirmation</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(emp.userId?.name)}</strong>,</p>
<p class="letter-p">We confirm your appointment on a <strong>part-time</strong> basis with <strong>${esc(co.name)}</strong>.</p>
<h2 class="letter-h2">Work schedule</h2>
${infoTable([
      ['Working hours', data.workingHours || 'As agreed'],
      ['Working days', data.workingDays || 'As agreed'],
      ['Start date', data.startDate || d],
      ['Department / branch', `${emp.department || '—'} / ${emp.branch?.name || '—'}`],
    ])}
<h2 class="letter-h2">Compensation</h2>
${infoTable([
      ['Hourly rate (LKR)', data.hourlyRate || 'As agreed'],
      ['Estimated monthly (LKR)', (emp.basicSalary || 0).toLocaleString('en-LK')],
    ])}
<p class="letter-p letter-small">Part-time status does not guarantee conversion to full-time employment. Schedules may be adjusted with reasonable notice.</p>
${signatureBlock(data.issuedByName, 'Human Resources')}
`;
  },

  resignation: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
<h1 class="letter-h1">Resignation — Acceptance</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(emp.userId?.name)}</strong>,</p>
<p class="letter-p">We acknowledge receipt of your resignation. This letter confirms acceptance of your resignation from the position of <strong>${esc(emp.designation)}</strong> (${esc(emp.department || '—')} department).</p>
<h2 class="letter-h2">Key dates</h2>
${infoTable([
      ['Resignation received', data.resignationDate || d],
      ['Last working day', data.endDate || 'To be confirmed'],
      ['Notice period', data.noticePeriod || '30 days'],
      ['Employee ID', emp.employeeNo || '—'],
    ])}
<h2 class="letter-h2">Clearance instructions</h2>
<ol class="letter-ol">
  <li>Complete handover of responsibilities and knowledge transfer.</li>
  <li>Return company assets, access cards, and IT equipment.</li>
  <li>Participate in exit interview when scheduled by HR.</li>
  <li>Settle outstanding advances or obligations in line with policy.</li>
</ol>
<p class="letter-p">We thank you for your contributions and wish you success in your future endeavours.</p>
${signatureBlock(data.issuedByName, 'Human Resources')}
`;
  },

  confirmation: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    const cd = data.confirmationDate || d;
    return `
<h1 class="letter-h1">Confirmation of Employment</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(emp.userId?.name)}</strong>,</p>
<p class="letter-p">Following successful completion of your probationary period, we are pleased to confirm your <strong>permanent employment</strong> as <strong>${esc(emp.designation)}</strong> with <strong>${esc(co.name)}</strong>, effective <strong>${esc(cd)}</strong>.</p>
<h2 class="letter-h2">Confirmation details</h2>
${infoTable([
      ['Employee ID', emp.employeeNo || '—'],
      ['Department', emp.department || '—'],
      ['Branch', emp.branch?.name || '—'],
      ['Effective confirmation date', cd],
    ])}
<h2 class="letter-h2">Benefits</h2>
<p class="letter-p">Benefits and entitlements applicable to confirmed employees shall apply from the effective confirmation date, in line with company policy and your grade.</p>
<p class="letter-p">Congratulations on your confirmation. We look forward to your continued contributions.</p>
${signatureBlock(data.issuedByName, 'Human Resources')}
`;
  },

  experience: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    const from = emp.joinedDate ? new Date(emp.joinedDate).toLocaleDateString('en-LK') : 'N/A';
    const to = data.endDate || new Date().toLocaleDateString('en-LK');
    return `
<h1 class="letter-h1">Certificate of Experience</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-p letter-upper"><strong>To whom it may concern,</strong></p>
<p class="letter-p">This is to certify that <strong>${esc(emp.userId?.name)}</strong> (NIC: <strong>${esc(emp.nic || 'N/A')}</strong>) was employed at <strong>${esc(co.name)}</strong> as <strong>${esc(emp.designation)}</strong> in the <strong>${esc(emp.department || '—')}</strong> department.</p>
<h2 class="letter-h2">Employment summary</h2>
${infoTable([
      ['Employee ID', emp.employeeNo || '—'],
      ['Period of service', `${from} — ${to}`],
      ['Branch', emp.branch?.name || '—'],
    ])}
<h2 class="letter-h2">Performance summary</h2>
<p class="letter-p">During the period of service, ${esc(emp.userId?.name)} maintained professional conduct and contributed to departmental objectives. This certificate is issued upon request for bona fide purposes.</p>
${signatureBlock(data.issuedByName, 'Director — Human Resources')}
`;
  },

  salary: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
<h1 class="letter-h1">Salary Confirmation</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-p letter-upper"><strong>To whom it may concern,</strong></p>
<p class="letter-p">This is to certify that <strong>${esc(emp.userId?.name)}</strong>, Employee ID <strong>${esc(emp.employeeNo || '—')}</strong>, is currently employed at <strong>${esc(co.name)}</strong> as <strong>${esc(emp.designation)}</strong> in the <strong>${esc(emp.department || '—')}</strong> department.</p>
<h2 class="letter-h2">Salary breakdown (LKR / month)</h2>
${salaryRows(emp)}
<p class="letter-p letter-small">Purpose: <strong>${esc(data.purpose || 'Official verification')}</strong>. This letter is issued for the stated purpose only and does not amend contractual terms.</p>
${signatureBlock(data.issuedByName, 'Human Resources — Official Verification')}
`;
  },

  service_agreement: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
<h1 class="letter-h1">Service Agreement</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-p">This agreement is entered into between <strong>${esc(co.name)}</strong> (“the Company”) and <strong>${esc(emp.userId?.name)}</strong> (“the Employee”) regarding the provision of services in the capacity of <strong>${esc(emp.designation)}</strong>.</p>
<h2 class="letter-h2">Parties &amp; scope</h2>
${infoTable([
      ['Employee ID', emp.employeeNo || '—'],
      ['Department / branch', `${emp.department || '—'} / ${emp.branch?.name || '—'}`],
      ['Service start', data.startDate || d],
    ])}
<h2 class="letter-h2">Scope of services</h2>
<p class="letter-p">${esc(data.scope || 'As per role responsibilities, assigned duties, and company policies.')}</p>
<h2 class="letter-h2">Confidentiality &amp; conduct</h2>
<p class="letter-p">The Employee shall protect confidential information, trade secrets, and personal data; comply with policies; and avoid conflicts of interest.</p>
<h2 class="letter-h2">Remuneration</h2>
${salaryRows(emp)}
<h2 class="letter-h2">Governing terms</h2>
<p class="letter-p">This agreement is governed by the laws of Sri Lanka. Disputes shall first be addressed through internal escalation in good faith.</p>
${signatureBlock(data.issuedByName, 'Authorised Representative')}
`;
  },

  custom: (emp, data, co) => {
    const d = new Date().toLocaleDateString('en-LK', { year: 'numeric', month: 'long', day: 'numeric' });
    const raw = data.customBody || 'Please replace this section with your letter content.';
    const paras = String(raw)
      .split(/\n{2,}/)
      .map((block) => `<p class="letter-p">${esc(block).replace(/\n/g, '<br/>')}</p>`)
      .join('');
    return `
<h1 class="letter-h1">${esc(data.letterTitle || 'Official Letter')}</h1>
<p class="letter-ref-line"><span class="letter-ref-label">Date:</span> ${esc(d)}</p>
<p class="letter-salutation">Dear <strong>${esc(emp.userId?.name)}</strong>,</p>
${paras}
<h2 class="letter-h2">Employee reference</h2>
${infoTable([
      ['Employee ID', emp.employeeNo || '—'],
      ['Designation', emp.designation || '—'],
      ['Department', emp.department || '—'],
      ['Branch', emp.branch?.name || '—'],
    ])}
${signatureBlock(data.issuedByName, data.signatoryTitle || 'Human Resources')}
`;
  },
};

function buildLetterBodyHtml(type, employee, data, company) {
  const fn = LETTER_HTML[type] || LETTER_HTML['custom'];
  if (!fn) throw new Error(`Unknown letter type: ${type}`);
  return fn(employee, data, company);
}

module.exports = { buildLetterBodyHtml, LETTER_HTML };

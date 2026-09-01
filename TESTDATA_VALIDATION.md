# Validation against testdata.zip

The supplied exports were inspected as the acceptance reference:

- Content progress: 63 learners × 763 resource columns. Outcomes found: Not Completed, Not Attempted, Completed, Passed and Failed.
- Quiz submissions: 349 submission rows, 197 unique learners and 30 assessments. All 349 sample rows were evaluated.
- Attempt report: 19 attempts, including test date, marks, total marks, percentage, pass/fail, time and Part A marks.

The portal now has a matching place for every supplied field:

- Learner profile: name, registration number, email and contact.
- Content: topic, material/activity name, type, assigned status, completion status and distinct quiz outcome.
- Submission: assessment name/type, attempt ID, submitted date, evaluated/pending state, marks, total, percentage and pass/fail.
- Attempt detail: time and Edmingle part/question detail, loaded on demand.
- View detail: individual material view timestamps, loaded on demand.

The synchronization still keeps PSNA's existing college boundary, approved bundle/master-batch allowlists and server-only API credentials. Existing tables are not dropped by the two upgrade migrations.

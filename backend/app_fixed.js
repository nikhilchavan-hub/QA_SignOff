// Express.js API for QA Sign Off Process Automation
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'qa_signoff',
  password: 'admin123',
  port: 5432,
});

const JWT_SECRET = 'your_jwt_secret'; // Change in production

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedExtensions = ['.zip', '.pdf', '.docx', '.csv', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.3gp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// --- User Registration ---
app.post('/api/signup', async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  if (!firstname || !lastname || !email || !password) return res.status(400).json({ error: 'All fields required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO "User" (firstname, lastname, email_id, password) VALUES ($1, $2, $3, $4) RETURNING userid, firstname, lastname, email_id',
      [firstname, lastname, email, hash]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

// --- User Login ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM "User" WHERE email_id=$1', [email]);
  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userid: user.userid, email: user.email_id }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { userid: user.userid, firstname: user.firstname, lastname: user.lastname, email: user.email_id } });
});

// --- Auth Middleware ---
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Get Current User ---
app.get('/api/user/me', auth, async (req, res) => {
  const result = await pool.query('SELECT userid, firstname, lastname, email_id FROM "User" WHERE userid=$1', [req.user.userid]);
  res.json({ user: result.rows[0] });
});

// --- Get VDS List ---
app.get('/api/getVDS', auth, async (req, res) => {
  const result = await pool.query('SELECT VDS_ID, VDS_Name FROM "VDS"');
  res.json(result.rows);
});

// --- Get Sign Off Details (Dashboard) ---
app.get('/api/signOffDetails', auth, async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const baseQuery = 'SELECT * FROM "Sign_Off_Req" WHERE project_name ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3';
  const result = await pool.query(baseQuery, [`%${search}%`, limit, offset]);
  res.json(result.rows);
});

// --- Get Sign Off by ID ---
app.get('/api/signoffs/:id', auth, async (req, res) => {
  const id = req.params.id;
  const signoff = await pool.query('SELECT * FROM "Sign_Off_Req" WHERE ID=$1', [id]);
  const testcases = await pool.query('SELECT * FROM "test_cases" WHERE sign_off_id=$1', [id]);
  const defects = await pool.query('SELECT * FROM "defects" WHERE sign_off_id=$1', [id]);
  res.json({ signoff: signoff.rows[0], testcases: testcases.rows, defects: defects.rows });
});

// --- Create/Update Sign Off ---
app.post('/api/signoffs', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Extract main form data
    const { project_name, VDS_id, user_id, status, observations, caveats, JIRA_Link, application, cm_number, end_date, project_details, qa, start_date, actual_start_date, actual_end_date, prod_rel_dt, rag_status, outofscope, evidences, comments, tasktype, signofftype, defect_filter_link, testCases, defects } = req.body;

    // Insert main sign off record
    const signOffResult = await client.query(
      'INSERT INTO "Sign_Off_Req" (project_name, VDS_id, user_id, status, observations, caveats, JIRA_Link, application, cm_number, end_date, project_details, qa, start_date, actual_start_date, actual_end_date, prod_rel_dt, rag_status, "outOfScope", evidences, comments, tasktype, "SignOffType", defect_filter_link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING ID',
      [project_name, VDS_id, user_id, status, observations, caveats, JIRA_Link, application, cm_number, end_date, project_details, qa, start_date, actual_start_date, actual_end_date, prod_rel_dt, rag_status, outofscope, evidences, comments, tasktype, signofftype, defect_filter_link]
    );
    
    const signOffId = signOffResult.rows[0].id;
    
    // Handle test cases data if provided
    if (testCases) {
      // Insert RIAST test cases
      if (testCases.passed || testCases.failed || testCases.unexecuted) {
        const riast_passed = testCases.passed?.riast || 0;
        const riast_failed = testCases.failed?.riast || 0;
        const riast_unexecuted = testCases.unexecuted?.riast || 0;
        const riast_total = riast_passed + riast_failed + riast_unexecuted;
        
        await client.query(
          'INSERT INTO "test_cases" (sign_off_id, test_type, Passed, Failed, "Non-Executed", Total) VALUES ($1, $2, $3, $4, $5, $6)',
          [signOffId, 'RIAST', riast_passed, riast_failed, riast_unexecuted, riast_total]
        );
      }
      
      // Insert RIASP test cases
      if (testCases.passed || testCases.failed || testCases.unexecuted) {
        const riasp_passed = testCases.passed?.riasp || 0;
        const riasp_failed = testCases.failed?.riasp || 0;
        const riasp_unexecuted = testCases.unexecuted?.riasp || 0;
        const riasp_total = riasp_passed + riasp_failed + riasp_unexecuted;
        
        await client.query(
          'INSERT INTO "test_cases" (sign_off_id, test_type, Passed, Failed, "Non-Executed", Total) VALUES ($1, $2, $3, $4, $5, $6)',
          [signOffId, 'RIASP', riasp_passed, riasp_failed, riasp_unexecuted, riasp_total]
        );
      }
    }
    
    // Handle defects data if provided
    if (defects) {
      // Insert Enhancements defects
      if (defects.enhancements) {
        const enh_resolved = defects.enhancements.resolved || 0;
        const enh_deferred = defects.enhancements.deferred || 0;
        const enh_total = enh_resolved + enh_deferred;
        
        await client.query(
          'INSERT INTO "defects" (sign_off_id, defect_type, Resolved, Deffered, Total) VALUES ($1, $2, $3, $4, $5)',
          [signOffId, 'Enhancements', enh_resolved, enh_deferred, enh_total]
        );
      }
      
      // Insert Defects
      if (defects.defects) {
        const def_resolved = defects.defects.resolved || 0;
        const def_deferred = defects.defects.deferred || 0;
        const def_total = def_resolved + def_deferred;
        
        await client.query(
          'INSERT INTO "defects" (sign_off_id, defect_type, Resolved, Deffered, Total) VALUES ($1, $2, $3, $4, $5)',
          [signOffId, 'Defects', def_resolved, def_deferred, def_total]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ id: signOffId });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating sign off:', err);
    res.status(500).json({ error: 'Failed to create sign off: ' + err.message });
  } finally {
    client.release();
  }
});

// --- Update Sign Off ---
app.put('/api/signoffs/:id', auth, async (req, res) => {
  const client = await pool.connect();
  const signOffId = req.params.id;
  
  try {
    await client.query('BEGIN');
    
    // Extract main form data
    const { project_name, VDS_id, user_id, status, observations, caveats, JIRA_Link, application, cm_number, end_date, project_details, qa, start_date, actual_start_date, actual_end_date, prod_rel_dt, rag_status, outofscope, defect_filter_link, evidences, comments, tasktype, signofftype, testCases, defects } = req.body;
    
    // Update main sign off record
    await client.query(
      'UPDATE "Sign_Off_Req" SET project_name=$1, VDS_id=$2, user_id=$3, status=$4, observations=$5, caveats=$6, JIRA_Link=$7, application=$8, cm_number=$9, end_date=$10, project_details=$11, qa=$12, start_date=$13, actual_start_date=$14, actual_end_date=$15, prod_rel_dt=$16, rag_status=$17, "outOfScope"=$18, defect_filter_link=$19, evidences=$20, comments=$21, tasktype=$22, "SignOffType"=$23, updated_at=CURRENT_TIMESTAMP WHERE ID=$24',
      [project_name, VDS_id, user_id, status, observations, caveats, JIRA_Link, application, cm_number, end_date, project_details, qa, start_date, actual_start_date, actual_end_date, prod_rel_dt, rag_status, outofscope, defect_filter_link, evidences, comments, tasktype, signofftype, signOffId]
    );
    
    // Delete existing test cases and defects to replace with new data
    await client.query('DELETE FROM "test_cases" WHERE sign_off_id=$1', [signOffId]);
    await client.query('DELETE FROM "defects" WHERE sign_off_id=$1', [signOffId]);
    
    // Handle test cases data if provided
    if (testCases) {
      // Insert RIAST test cases
      if (testCases.passed || testCases.failed || testCases.unexecuted) {
        const riast_passed = testCases.passed?.riast || 0;
        const riast_failed = testCases.failed?.riast || 0;
        const riast_unexecuted = testCases.unexecuted?.riast || 0;
        const riast_total = riast_passed + riast_failed + riast_unexecuted;
        
        await client.query(
          'INSERT INTO "test_cases" (sign_off_id, test_type, Passed, Failed, "Non-Executed", Total) VALUES ($1, $2, $3, $4, $5, $6)',
          [signOffId, 'RIAST', riast_passed, riast_failed, riast_unexecuted, riast_total]
        );
      }
      
      // Insert RIASP test cases
      if (testCases.passed || testCases.failed || testCases.unexecuted) {
        const riasp_passed = testCases.passed?.riasp || 0;
        const riasp_failed = testCases.failed?.riasp || 0;
        const riasp_unexecuted = testCases.unexecuted?.riasp || 0;
        const riasp_total = riasp_passed + riasp_failed + riasp_unexecuted;
        
        await client.query(
          'INSERT INTO "test_cases" (sign_off_id, test_type, Passed, Failed, "Non-Executed", Total) VALUES ($1, $2, $3, $4, $5, $6)',
          [signOffId, 'RIASP', riasp_passed, riasp_failed, riasp_unexecuted, riasp_total]
        );
      }
    }
    
    // Handle defects data if provided
    if (defects) {
      // Insert Enhancements defects
      if (defects.enhancements) {
        const enh_resolved = defects.enhancements.resolved || 0;
        const enh_deferred = defects.enhancements.deferred || 0;
        const enh_total = enh_resolved + enh_deferred;
        
        await client.query(
          'INSERT INTO "defects" (sign_off_id, defect_type, Resolved, Deffered, Total) VALUES ($1, $2, $3, $4, $5)',
          [signOffId, 'Enhancements', enh_resolved, enh_deferred, enh_total]
        );
      }
      
      // Insert Defects
      if (defects.defects) {
        const def_resolved = defects.defects.resolved || 0;
        const def_deferred = defects.defects.deferred || 0;
        const def_total = def_resolved + def_deferred;
        
        await client.query(
          'INSERT INTO "defects" (sign_off_id, defect_type, Resolved, Deffered, Total) VALUES ($1, $2, $3, $4, $5)',
          [signOffId, 'Defects', def_resolved, def_deferred, def_total]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ id: signOffId, message: 'Sign off updated successfully' });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating sign off:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
      where: err.where
    });
    
    // Provide more specific error messages
    if (err.code === '42703') {
      res.status(500).json({ error: `Database column error: ${err.message}` });
    } else if (err.code === '23505') {
      res.status(400).json({ error: 'Duplicate entry detected' });
    } else if (err.code === '23503') {
      res.status(400).json({ error: 'Referenced record not found' });
    } else {
      res.status(500).json({ error: 'Failed to update sign off: ' + err.message });
    }
  } finally {
    client.release();
  }
});

// --- Add Test Case ---
app.post('/api/testcases', auth, async (req, res) => {
  const { sign_off_id, test_type, Passed, Failed, Total, NonExecuted } = req.body;
  const result = await pool.query(
    'INSERT INTO "test_cases" (sign_off_id, test_type, Passed, Failed, Total, "Non-Executed") VALUES ($1, $2, $3, $4, $5, $6) RETURNING ID',
    [sign_off_id, test_type, Passed, Failed, Total, NonExecuted]
  );
  res.json({ id: result.rows[0].id });
});

// --- Add Defect ---
app.post('/api/defects', auth, async (req, res) => {
  const { sign_off_id, defect_type, Resolved, Deffered, Total, defect_filter_Link } = req.body;
  const result = await pool.query(
    'INSERT INTO "defects" (sign_off_id, defect_type, Resolved, Deffered, Total, defect_filter_Link) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ID',
    [sign_off_id, defect_type, Resolved, Deffered, Total, defect_filter_Link]
  );
  res.json({ id: result.rows[0].id });
});

// --- Knowledge Share APIs ---

// Get all knowledge share items
app.get('/api/knowledge-share', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ks.*, u.firstname, u.lastname,
             CONCAT(u.firstname, ' ', u.lastname) as author_name
      FROM "knowledge_share" ks
      JOIN "User" u ON ks.user_id = u.userid
      ORDER BY ks.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching knowledge share items:', err);
    res.status(500).json({ error: 'Failed to fetch knowledge share items' });
  }
});

// Create new knowledge share item
app.post('/api/knowledge-share', auth, upload.single('document'), async (req, res) => {
  try {
    const { subject, description, user_id } = req.body;
    
    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }
    
    const uploadedDocument = req.file ? req.file.filename : null;
    
    const result = await pool.query(
      'INSERT INTO "knowledge_share" (Subject, Description, UploadedDocument, user_id) VALUES ($1, $2, $3, $4) RETURNING ID',
      [subject, description, uploadedDocument, user_id]
    );
    
    res.json({ id: result.rows[0].id, message: 'Knowledge share item created successfully' });
  } catch (err) {
    console.error('Error creating knowledge share item:', err);
    res.status(500).json({ error: 'Failed to create knowledge share item' });
  }
});

// Download knowledge share file
app.get('/api/knowledge-share/:id/download', auth, async (req, res) => {
  try {
    const id = req.params.id;
    
    const result = await pool.query(
      'SELECT UploadedDocument FROM "knowledge_share" WHERE ID = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Knowledge share item not found' });
    }
    
    const filename = result.rows[0].uploadeddocument;
    
    if (!filename) {
      return res.status(404).json({ error: 'No file associated with this item' });
    }
    
    const filePath = path.join(__dirname, 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    res.download(filePath, filename);
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));

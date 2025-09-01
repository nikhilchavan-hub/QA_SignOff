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
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Email configuration with multiple fallback options
const emailConfigs = [
  // Configuration 1: Gmail with explicit host and port 587 (TLS)
  {
    name: 'Gmail TLS (Port 587)',
    config: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'pravintestnodeapp@gmail.com',
        pass: 'Node@123456789'
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000      // 60 seconds
    }
  },
  // Configuration 2: Gmail with port 465 (SSL)
  {
    name: 'Gmail SSL (Port 465)',
    config: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'pravintestnodeapp@gmail.com',
        pass: 'Node@123456789'
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000
    }
  },
  // Configuration 3: Gmail service shorthand
  {
    name: 'Gmail Service',
    config: {
      service: 'gmail',
      auth: {
        user: 'pravintestnodeapp@gmail.com',
        pass: 'Node@123456789'
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000
    }
  },
  // Configuration 4: Outlook/Hotmail as backup
  {
    name: 'Outlook SMTP',
    config: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      auth: {
        user: 'pravintestnodeapp@gmail.com', // You may need to create an Outlook account
        pass: 'Node@123456789'
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000
    }
  }
];

let emailTransporter = null;
let currentConfigIndex = 0;

// Function to create email transporter with fallback
const createEmailTransporter = async () => {
  for (let i = 0; i < emailConfigs.length; i++) {
    try {
      const config = emailConfigs[i];
      console.log(`Attempting to create email transporter with ${config.name}...`);
      
      const transporter = nodemailer.createTransport(config.config);
      
      // Verify the connection with timeout
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection verification timeout')), 10000)
        )
      ]);
      
      console.log(`Successfully connected to SMTP server using ${config.name}`);
      currentConfigIndex = i;
      return transporter;
    } catch (error) {
      console.error(`Failed to connect with ${emailConfigs[i].name}:`, error.message);
      
      if (i === emailConfigs.length - 1) {
        console.error('All email configurations failed');
        throw new Error('Unable to establish email connection with any configuration');
      }
    }
  }
};

// Initialize email transporter
const initializeEmailTransporter = async () => {
  try {
    emailTransporter = await createEmailTransporter();
  } catch (error) {
    console.error('Failed to initialize email transporter:', error.message);
    console.log('Email functionality will be disabled');
    emailTransporter = null;
  }
};

// Initialize on startup
initializeEmailTransporter();

// Function to generate HTML email template for sign-off
const generateSignOffEmailHTML = (signoffData, testCases, defects, vdsName) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getRagStatusStyle = (status) => {
    switch(status) {
      case 'RED': return 'background-color: #ffebee; color: #c62828; padding: 4px 8px; border-radius: 4px;';
      case 'AMBER': return 'background-color: #fff8e1; color: #f57c00; padding: 4px 8px; border-radius: 4px;';
      case 'GREEN': return 'background-color: #e8f5e8; color: #2e7d32; padding: 4px 8px; border-radius: 4px;';
      default: return '';
    }
  };

  // Process test cases data
  const testCasesData = {
    passed: { riast: 0, riasp: 0 },
    failed: { riast: 0, riasp: 0 },
    unexecuted: { riast: 0, riasp: 0 }
  };
  
  if (testCases && testCases.length > 0) {
    testCases.forEach(tc => {
      if (tc.test_type === 'RIAST') {
        testCasesData.passed.riast = tc.passed || 0;
        testCasesData.failed.riast = tc.failed || 0;
        testCasesData.unexecuted.riast = tc['non-executed'] || 0;
      } else if (tc.test_type === 'RIASP') {
        testCasesData.passed.riasp = tc.passed || 0;
        testCasesData.failed.riasp = tc.failed || 0;
        testCasesData.unexecuted.riasp = tc['non-executed'] || 0;
      }
    });
  }

  // Process defects data
  const defectsData = {
    enhancements: { resolved: 0, deferred: 0 },
    defects: { resolved: 0, deferred: 0 }
  };
  
  if (defects && defects.length > 0) {
    defects.forEach(def => {
      if (def.defect_type === 'Enhancements') {
        defectsData.enhancements.resolved = def.resolved || 0;
        defectsData.enhancements.deferred = def.deffered || 0;
      } else if (def.defect_type === 'Defects') {
        defectsData.defects.resolved = def.resolved || 0;
        defectsData.defects.deferred = def.deffered || 0;
      }
    });
  }

  const calculateTestCaseTotal = (column) => {
    return (testCasesData.passed[column] || 0) + 
           (testCasesData.failed[column] || 0) + 
           (testCasesData.unexecuted[column] || 0);
  };

  const calculateDefectsTotal = (column) => {
    return (defectsData.enhancements[column] || 0) + 
           (defectsData.defects[column] || 0);
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>QA Sign Off - ${signoffData.project_name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 25px; }
        .row { display: flex; margin-bottom: 15px; }
        .col { flex: 1; margin-right: 20px; }
        .col:last-child { margin-right: 0; }
        .form-group { margin-bottom: 15px; }
        .form-group label { font-weight: bold; color: #555; display: block; margin-bottom: 5px; }
        .form-value { padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9; min-height: 20px; }
        .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        .table th { background-color: #f8f9fa; font-weight: bold; }
        .table-secondary { background-color: #f8f9fa; font-weight: bold; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .status-complete { background-color: #d4edda; color: #155724; }
        .status-inprogress { background-color: #fff3cd; color: #856404; }
        h4 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>QA Sign Off Report</h1>
          <h2>${signoffData.project_name}</h2>
          <p>Status: <span class="status-badge ${signoffData.status === 'Complete' ? 'status-complete' : 'status-inprogress'}">${signoffData.status}</span></p>
        </div>

        <div class="section">
          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Project Name</label>
                <div class="form-value">${signoffData.project_name || 'N/A'}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>VDS</label>
                <div class="form-value">${vdsName || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Application</label>
                <div class="form-value">${signoffData.application || 'N/A'}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>QA</label>
                <div class="form-value">${signoffData.qa || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Start Date</label>
                <div class="form-value">${formatDate(signoffData.start_date)}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>End Date</label>
                <div class="form-value">${formatDate(signoffData.end_date)}</div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Actual Start Date</label>
                <div class="form-value">${formatDate(signoffData.actual_start_date)}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>Actual End Date</label>
                <div class="form-value">${formatDate(signoffData.actual_end_date)}</div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Production Release Date</label>
                <div class="form-value">${formatDate(signoffData.prod_rel_dt)}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>RAG Status</label>
                <div class="form-value">
                  <span style="${getRagStatusStyle(signoffData.rag_status)}">${signoffData.rag_status || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Task Type</label>
                <div class="form-value">${signoffData.tasktype || 'N/A'}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>Sign-Off Type</label>
                <div class="form-value">${signoffData.SignOffType || signoffData.signofftype || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>CM Number</label>
                <div class="form-value">${signoffData.cm_number || 'N/A'}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>JIRA Link</label>
                <div class="form-value">${signoffData.jira_link ? `<a href="${signoffData.jira_link}">${signoffData.jira_link}</a>` : 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Project Details</label>
            <div class="form-value">${signoffData.project_details || 'N/A'}</div>
          </div>

          <div class="form-group">
            <label>Observations</label>
            <div class="form-value">${signoffData.observations || 'N/A'}</div>
          </div>

          <div class="form-group">
            <label>Caveats</label>
            <div class="form-value">${signoffData.caveats || 'N/A'}</div>
          </div>

          <div class="form-group">
            <label>Out Of Scope</label>
            <div class="form-value">${signoffData.outOfScope || signoffData.outofscope || 'N/A'}</div>
          </div>

          <div class="row">
            <div class="col">
              <div class="form-group">
                <label>Defect Filter Link</label>
                <div class="form-value">${signoffData.defect_filter_link ? `<a href="${signoffData.defect_filter_link}">${signoffData.defect_filter_link}</a>` : 'N/A'}</div>
              </div>
            </div>
            <div class="col">
              <div class="form-group">
                <label>Evidences</label>
                <div class="form-value">${signoffData.evidences || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Sign-Off Comments</label>
            <div class="form-value">${signoffData.comments || 'N/A'}</div>
          </div>

          <h4>Test Cases</h4>
          <table class="table">
            <thead>
              <tr>
                <th>Test Cases</th>
                <th>RIAST</th>
                <th>RIASP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Passed</strong></td>
                <td>${testCasesData.passed.riast}</td>
                <td>${testCasesData.passed.riasp}</td>
              </tr>
              <tr>
                <td><strong>Failed</strong></td>
                <td>${testCasesData.failed.riast}</td>
                <td>${testCasesData.failed.riasp}</td>
              </tr>
              <tr>
                <td><strong>Unexecuted</strong></td>
                <td>${testCasesData.unexecuted.riast}</td>
                <td>${testCasesData.unexecuted.riasp}</td>
              </tr>
              <tr class="table-secondary">
                <td><strong>Total</strong></td>
                <td><strong>${calculateTestCaseTotal('riast')}</strong></td>
                <td><strong>${calculateTestCaseTotal('riasp')}</strong></td>
              </tr>
            </tbody>
          </table>

          <h4>Defects</h4>
          <table class="table">
            <thead>
              <tr>
                <th>Defects</th>
                <th>Resolved</th>
                <th>Deferred</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Enhancements</strong></td>
                <td>${defectsData.enhancements.resolved}</td>
                <td>${defectsData.enhancements.deferred}</td>
              </tr>
              <tr>
                <td><strong>Defects</strong></td>
                <td>${defectsData.defects.resolved}</td>
                <td>${defectsData.defects.deferred}</td>
              </tr>
              <tr class="table-secondary">
                <td><strong>Total</strong></td>
                <td><strong>${calculateDefectsTotal('resolved')}</strong></td>
                <td><strong>${calculateDefectsTotal('deferred')}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-radius: 5px; text-align: center;">
          <p><em>This email was generated automatically from the QA Sign Off Process Automation system.</em></p>
          <p><em>Generated on: ${new Date().toLocaleString()}</em></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Function to send sign-off email with retry logic
const sendSignOffEmail = async (userEmail, signoffData, testCases, defects, vdsName) => {
  // Check if email transporter is available
  if (!emailTransporter) {
    console.log('Email transporter not available, attempting to reinitialize...');
    try {
      await initializeEmailTransporter();
      if (!emailTransporter) {
        throw new Error('Email service unavailable');
      }
    } catch (error) {
      console.error('Failed to initialize email transporter:', error.message);
      return { success: false, error: 'Email service unavailable' };
    }
  }

  try {
    const emailHTML = generateSignOffEmailHTML(signoffData, testCases, defects, vdsName);
    
    const mailOptions = {
      from: 'pravintestnodeapp@gmail.com',
      to: userEmail,
      subject: `QA Sign Off - ${signoffData.project_name}`,
      html: emailHTML
    };

    // Try to send email with timeout
    const result = await Promise.race([
      emailTransporter.sendMail(mailOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email send timeout')), 30000)
      )
    ]);
    
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error.message);
    
    // If current transporter fails, try to reinitialize with next config
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION' || error.message.includes('timeout')) {
      console.log('Connection issue detected, trying to reinitialize with different configuration...');
      try {
        // Move to next configuration
        currentConfigIndex = (currentConfigIndex + 1) % emailConfigs.length;
        emailTransporter = await createEmailTransporter();
        
        // Retry sending email once with new transporter
        const mailOptions = {
          from: 'pravintestnodeapp@gmail.com',
          to: userEmail,
          subject: `QA Sign Off - ${signoffData.project_name}`,
          html: generateSignOffEmailHTML(signoffData, testCases, defects, vdsName)
        };
        
        const result = await Promise.race([
          emailTransporter.sendMail(mailOptions),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email send timeout on retry')), 30000)
          )
        ]);
        
        console.log('Email sent successfully on retry:', result.messageId);
        return { success: true, messageId: result.messageId };
      } catch (retryError) {
        console.error('Retry also failed:', retryError.message);
        emailTransporter = null; // Reset transporter
        return { success: false, error: `Email send failed: ${error.message}. Retry failed: ${retryError.message}` };
      }
    }
    
    return { success: false, error: error.message };
  }
};

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
    
    // Send email if status is Complete
    let emailStatus = '';
    if (status === 'Complete') {
      try {
        // Get user email
        const userResult = await pool.query('SELECT email_id FROM "User" WHERE userid = $1', [user_id]);
        if (userResult.rows.length > 0) {
          const userEmail = userResult.rows[0].email_id;
          
          // Get VDS name
          const vdsResult = await pool.query('SELECT vds_name FROM "VDS" WHERE vds_id = $1', [VDS_id]);
          const vdsName = vdsResult.rows.length > 0 ? vdsResult.rows[0].vds_name : 'N/A';
          
          // Get the complete sign-off data for email
          const signoffResult = await pool.query('SELECT * FROM "Sign_Off_Req" WHERE ID = $1', [signOffId]);
          const testCasesResult = await pool.query('SELECT * FROM "test_cases" WHERE sign_off_id = $1', [signOffId]);
          const defectsResult = await pool.query('SELECT * FROM "defects" WHERE sign_off_id = $1', [signOffId]);
          
          const emailResult = await sendSignOffEmail(
            userEmail,
            signoffResult.rows[0],
            testCasesResult.rows,
            defectsResult.rows,
            vdsName
          );
          
          if (emailResult.success) {
            console.log('Sign-off email sent successfully to:', userEmail);
            emailStatus = ' Email notification sent successfully.';
          } else {
            console.error('Failed to send sign-off email:', emailResult.error);
            emailStatus = ' (Note: Email notification could not be sent)';
          }
        } else {
          emailStatus = ' (Note: User email not found for notification)';
        }
      } catch (emailError) {
        console.error('Error in email sending process:', emailError);
        emailStatus = ' (Note: Email notification failed)';
      }
    }
    
    res.json({ 
      id: signOffId, 
      message: status === 'Complete' ? `Sign off submitted successfully!${emailStatus}` : 'Sign off saved successfully!'
    });
    
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
    
    // Send email if status is Complete
    let emailStatus = '';
    if (status === 'Complete') {
      try {
        // Get user email
        const userResult = await pool.query('SELECT email_id FROM "User" WHERE userid = $1', [user_id]);
        if (userResult.rows.length > 0) {
          const userEmail = userResult.rows[0].email_id;
          
          // Get VDS name
          const vdsResult = await pool.query('SELECT vds_name FROM "VDS" WHERE vds_id = $1', [VDS_id]);
          const vdsName = vdsResult.rows.length > 0 ? vdsResult.rows[0].vds_name : 'N/A';
          
          // Get the complete sign-off data for email
          const signoffResult = await pool.query('SELECT * FROM "Sign_Off_Req" WHERE ID = $1', [signOffId]);
          const testCasesResult = await pool.query('SELECT * FROM "test_cases" WHERE sign_off_id = $1', [signOffId]);
          const defectsResult = await pool.query('SELECT * FROM "defects" WHERE sign_off_id = $1', [signOffId]);
          
          const emailResult = await sendSignOffEmail(
            userEmail,
            signoffResult.rows[0],
            testCasesResult.rows,
            defectsResult.rows,
            vdsName
          );
          
          if (emailResult.success) {
            console.log('Sign-off email sent successfully to:', userEmail);
            emailStatus = ' Email notification sent successfully.';
          } else {
            console.error('Failed to send sign-off email:', emailResult.error);
            emailStatus = ' (Note: Email notification could not be sent)';
          }
        } else {
          emailStatus = ' (Note: User email not found for notification)';
        }
      } catch (emailError) {
        console.error('Error in email sending process:', emailError);
        emailStatus = ' (Note: Email notification failed)';
      }
    }
    
    res.json({ 
      id: signOffId, 
      message: status === 'Complete' ? `Sign off updated and submitted successfully!${emailStatus}` : 'Sign off updated successfully!'
    });
    
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

// Test email configuration endpoint
app.get('/api/test-email', async (req, res) => {
  try {
    if (!emailTransporter) {
      console.log('Email transporter not available, attempting to initialize...');
      await initializeEmailTransporter();
    }
    
    if (emailTransporter) {
      // Test the connection
      await emailTransporter.verify();
      const currentConfig = emailConfigs[currentConfigIndex];
      res.json({ 
        success: true, 
        message: 'Email configuration is working', 
        config: currentConfig.name 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Email transporter could not be initialized' 
      });
    }
  } catch (error) {
    console.error('Email test failed:', error.message);
    res.json({ 
      success: false, 
      message: 'Email configuration test failed', 
      error: error.message 
    });
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));

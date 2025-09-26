-- ============================================================================
-- QA Sign Off Process Automation - Complete Database Schema
-- PostgreSQL Database Setup Script
-- 
-- Version: 2.0
-- Created: September 2025
-- Description: Complete database structure with proper table names, 
--              column names, constraints, indexes, triggers, and sample data
-- ============================================================================

-- Create Database (execute this separately with appropriate permissions)
-- CREATE DATABASE qa_signoff ENCODING 'UTF8' LC_COLLATE='C' LC_CTYPE='C';

-- Connect to the database before running the rest of the script
-- \c qa_signoff;

-- ============================================================================
-- SCHEMA CREATION
-- ============================================================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS "knowledge_share" CASCADE;
DROP TABLE IF EXISTS "defects" CASCADE;
DROP TABLE IF EXISTS "test_cases" CASCADE;
DROP TABLE IF EXISTS "Sign_Off_Req" CASCADE;
DROP TABLE IF EXISTS "VDS" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

-- User Management Table
CREATE TABLE "User" (
    userid SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    email_id VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_email_format CHECK (email_id ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_firstname_length CHECK (LENGTH(firstname) >= 2),
    CONSTRAINT chk_lastname_length CHECK (LENGTH(lastname) >= 2)
);

-- VDS (Value Delivery Stream) Reference Table
CREATE TABLE "VDS" (
    VDS_ID SERIAL PRIMARY KEY,
    VDS_Name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_vds_name_length CHECK (LENGTH(VDS_Name) >= 3)
);

-- Main Sign Off Request Table
CREATE TABLE "Sign_Off_Req" (
    ID SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    application VARCHAR(255),
    qa VARCHAR(255),
    start_date DATE,
    end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    cm_number VARCHAR(100),
    prod_rel_dt DATE,
    rag_status VARCHAR(50) CHECK (rag_status IN ('RED', 'AMBER', 'GREEN')),
    project_details TEXT,
    observations TEXT,
    "outOfScope" TEXT,
    caveats TEXT,
    evidences TEXT,
    comments TEXT,
    tasktype VARCHAR(100),
    "SignOffType" VARCHAR(100),
    defect_filter_link TEXT,
    JIRA_Link TEXT,
    VDS_id INTEGER NOT NULL REFERENCES "VDS"(VDS_ID) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES "User"(userid) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'In progress', 'Complete', 'Rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_project_name_length CHECK (LENGTH(project_name) >= 3),
    CONSTRAINT chk_date_logic CHECK (
        (start_date IS NULL OR end_date IS NULL OR start_date <= end_date) AND
        (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_start_date <= actual_end_date)
    )
);

-- Test Cases Table
CREATE TABLE "test_cases" (
    ID SERIAL PRIMARY KEY,
    sign_off_id INTEGER NOT NULL REFERENCES "Sign_Off_Req"(ID) ON DELETE CASCADE,
    test_type VARCHAR(50) NOT NULL CHECK (test_type IN ('RIAST', 'RIASP')),
    Passed INTEGER DEFAULT 0 CHECK (Passed >= 0),
    Failed INTEGER DEFAULT 0 CHECK (Failed >= 0),
    "Non-Executed" INTEGER DEFAULT 0 CHECK ("Non-Executed" >= 0),
    Total INTEGER DEFAULT 0 CHECK (Total >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_test_totals CHECK (Total = Passed + Failed + "Non-Executed"),
    UNIQUE(sign_off_id, test_type)
);

-- Defects Table
CREATE TABLE "defects" (
    ID SERIAL PRIMARY KEY,
    sign_off_id INTEGER NOT NULL REFERENCES "Sign_Off_Req"(ID) ON DELETE CASCADE,
    defect_type VARCHAR(50) NOT NULL CHECK (defect_type IN ('Enhancements', 'Defects')),
    Resolved INTEGER DEFAULT 0 CHECK (Resolved >= 0),
    Deffered INTEGER DEFAULT 0 CHECK (Deffered >= 0),
    Total INTEGER DEFAULT 0 CHECK (Total >= 0),
    defect_filter_Link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_defect_totals CHECK (Total = Resolved + Deffered),
    UNIQUE(sign_off_id, defect_type)
);

-- Knowledge Share Table
CREATE TABLE "knowledge_share" (
    ID SERIAL PRIMARY KEY,
    Subject VARCHAR(255) NOT NULL,
    Description TEXT NOT NULL,
    UploadedDocument VARCHAR(255),
    file_size BIGINT,
    file_type VARCHAR(100),
    download_count INTEGER DEFAULT 0,
    user_id INTEGER NOT NULL REFERENCES "User"(userid) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_subject_length CHECK (LENGTH(Subject) >= 5),
    CONSTRAINT chk_description_length CHECK (LENGTH(Description) >= 10)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- User table indexes
CREATE INDEX idx_user_email ON "User"(email_id);
CREATE INDEX idx_user_name ON "User"(firstname, lastname);
CREATE INDEX idx_user_active ON "User"(is_active);

-- VDS table indexes
CREATE INDEX idx_vds_name ON "VDS"(VDS_Name);
CREATE INDEX idx_vds_active ON "VDS"(is_active);

-- Sign_Off_Req table indexes
CREATE INDEX idx_sign_off_vds_id ON "Sign_Off_Req"(VDS_id);
CREATE INDEX idx_sign_off_user_id ON "Sign_Off_Req"(user_id);
CREATE INDEX idx_sign_off_status ON "Sign_Off_Req"(status);
CREATE INDEX idx_sign_off_project_name ON "Sign_Off_Req"(project_name);
CREATE INDEX idx_sign_off_rag_status ON "Sign_Off_Req"(rag_status);
CREATE INDEX idx_sign_off_created_at ON "Sign_Off_Req"(created_at);
CREATE INDEX idx_sign_off_dates ON "Sign_Off_Req"(start_date, end_date);

-- Test cases table indexes
CREATE INDEX idx_test_cases_sign_off_id ON "test_cases"(sign_off_id);
CREATE INDEX idx_test_cases_type ON "test_cases"(test_type);

-- Defects table indexes
CREATE INDEX idx_defects_sign_off_id ON "defects"(sign_off_id);
CREATE INDEX idx_defects_type ON "defects"(defect_type);

-- Knowledge share table indexes
CREATE INDEX idx_knowledge_share_user_id ON "knowledge_share"(user_id);
CREATE INDEX idx_knowledge_share_subject ON "knowledge_share"(Subject);
CREATE INDEX idx_knowledge_share_active ON "knowledge_share"(is_active);
CREATE INDEX idx_knowledge_share_created_at ON "knowledge_share"(created_at);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vds_updated_at 
    BEFORE UPDATE ON "VDS"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sign_off_req_updated_at 
    BEFORE UPDATE ON "Sign_Off_Req"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_cases_updated_at 
    BEFORE UPDATE ON "test_cases"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_defects_updated_at 
    BEFORE UPDATE ON "defects"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_share_updated_at 
    BEFORE UPDATE ON "knowledge_share"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically calculate test case totals
CREATE OR REPLACE FUNCTION calculate_test_totals()
RETURNS TRIGGER AS $$
BEGIN
    NEW.Total = COALESCE(NEW.Passed, 0) + COALESCE(NEW.Failed, 0) + COALESCE(NEW."Non-Executed", 0);
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger for test case total calculation
CREATE TRIGGER calculate_test_totals_trigger
    BEFORE INSERT OR UPDATE ON "test_cases"
    FOR EACH ROW EXECUTE FUNCTION calculate_test_totals();

-- Function to automatically calculate defect totals
CREATE OR REPLACE FUNCTION calculate_defect_totals()
RETURNS TRIGGER AS $$
BEGIN
    NEW.Total = COALESCE(NEW.Resolved, 0) + COALESCE(NEW.Deffered, 0);
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger for defect total calculation
CREATE TRIGGER calculate_defect_totals_trigger
    BEFORE INSERT OR UPDATE ON "defects"
    FOR EACH ROW EXECUTE FUNCTION calculate_defect_totals();

-- ============================================================================
-- SAMPLE DATA INSERTION
-- ============================================================================

-- Insert sample VDS data
INSERT INTO "VDS" (VDS_Name, description) VALUES 
('S&P Trailblazer', 'S&P Global Trailblazer platform for market intelligence'),
('Invollo', 'Invoice and billing management system'),
('Digiexpert', 'Digital expertise and consulting platform'),
('DataStream Pro', 'Real-time data streaming and analytics platform'),
('CloudSecure', 'Cloud security and compliance management system');

-- Insert sample users (password is 'admin123' hashed with bcrypt cost 10)
INSERT INTO "User" (firstname, lastname, email_id, password, role) VALUES 
('Admin', 'User', 'admin@test.com', '$2b$10$rOZY3A8xqIVq8xqk9z1zNu9RVZ3h8QbB8YfN6yPqVBfVwUvyKQXXK', 'admin'),
('John', 'Doe', 'john.doe@test.com', '$2b$10$rOZY3A8xqIVq8xqk9z1zNu9RVZ3h8QbB8YfN6yPqVBfVwUvyKQXXK', 'user'),
('Jane', 'Smith', 'jane.smith@test.com', '$2b$10$rOZY3A8xqIVq8xqk9z1zNu9RVZ3h8QbB8YfN6yPqVBfVwUvyKQXXK', 'user'),
('Mike', 'Johnson', 'mike.johnson@test.com', '$2b$10$rOZY3A8xqIVq8xqk9z1zNu9RVZ3h8QbB8YfN6yPqVBfVwUvyKQXXK', 'user'),
('Sarah', 'Wilson', 'sarah.wilson@test.com', '$2b$10$rOZY3A8xqIVq8xqk9z1zNu9RVZ3h8QbB8YfN6yPqVBfVwUvyKQXXK', 'user');

-- Insert sample sign-off data
INSERT INTO "Sign_Off_Req" (
    project_name, application, qa, VDS_id, user_id, status, 
    start_date, end_date, rag_status, tasktype, "SignOffType"
) VALUES 
('Market Data Integration', 'TradeAnalytics', 'John Doe', 1, 2, 'Complete', 
 '2025-01-15', '2025-02-28', 'GREEN', 'Development', 'Full Sign-off'),
('Invoice Processing Enhancement', 'InvoiceManager', 'Jane Smith', 2, 3, 'In progress', 
 '2025-02-01', '2025-03-15', 'AMBER', 'Enhancement', 'Partial Sign-off'),
('Security Audit Module', 'SecureCloud', 'Mike Johnson', 5, 4, 'Complete', 
 '2025-01-10', '2025-02-20', 'GREEN', 'Security', 'Full Sign-off');

-- Insert sample test cases
INSERT INTO "test_cases" (sign_off_id, test_type, Passed, Failed, "Non-Executed") VALUES 
(1, 'RIAST', 45, 3, 2),
(1, 'RIASP', 28, 1, 1),
(2, 'RIAST', 32, 5, 8),
(2, 'RIASP', 15, 2, 3),
(3, 'RIAST', 55, 2, 1),
(3, 'RIASP', 33, 0, 2);

-- Insert sample defects
INSERT INTO "defects" (sign_off_id, defect_type, Resolved, Deffered) VALUES 
(1, 'Enhancements', 8, 2),
(1, 'Defects', 12, 1),
(2, 'Enhancements', 5, 3),
(2, 'Defects', 7, 4),
(3, 'Enhancements', 3, 1),
(3, 'Defects', 5, 0);

-- Insert sample knowledge share items
INSERT INTO "knowledge_share" (Subject, Description, user_id) VALUES 
('QA Best Practices for Financial Applications', 
 'Comprehensive guide covering testing strategies specific to financial applications including compliance, security, and performance testing methodologies.', 
 2),
('Automated Testing Framework Setup', 
 'Step-by-step guide for setting up automated testing frameworks using Selenium and Jest for web applications.', 
 3),
('Security Testing Checklist', 
 'Complete checklist for security testing including OWASP top 10 vulnerabilities and mitigation strategies.', 
 4),
('Performance Testing Guidelines', 
 'Guidelines for performance testing including load testing scenarios, tools, and performance metrics interpretation.', 
 5);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for sign-off summary with user and VDS information
CREATE VIEW sign_off_summary AS
SELECT 
    s.ID,
    s.project_name,
    s.application,
    s.qa,
    s.status,
    s.rag_status,
    s.start_date,
    s.end_date,
    s.created_at,
    v.VDS_Name,
    u.firstname || ' ' || u.lastname AS created_by,
    u.email_id AS creator_email
FROM "Sign_Off_Req" s
JOIN "VDS" v ON s.VDS_id = v.VDS_ID
JOIN "User" u ON s.user_id = u.userid
WHERE u.is_active = TRUE AND v.is_active = TRUE;

-- View for test case summary
CREATE VIEW test_case_summary AS
SELECT 
    tc.sign_off_id,
    s.project_name,
    tc.test_type,
    tc.Passed,
    tc.Failed,
    tc."Non-Executed",
    tc.Total,
    ROUND((tc.Passed::DECIMAL / NULLIF(tc.Total, 0)) * 100, 2) AS pass_rate
FROM "test_cases" tc
JOIN "Sign_Off_Req" s ON tc.sign_off_id = s.ID;

-- View for defect summary
CREATE VIEW defect_summary AS
SELECT 
    d.sign_off_id,
    s.project_name,
    d.defect_type,
    d.Resolved,
    d.Deffered,
    d.Total,
    ROUND((d.Resolved::DECIMAL / NULLIF(d.Total, 0)) * 100, 2) AS resolution_rate
FROM "defects" d
JOIN "Sign_Off_Req" s ON d.sign_off_id = s.ID;

-- ============================================================================
-- GRANTS AND PERMISSIONS
-- ============================================================================

-- Create roles for different access levels
-- Note: Uncomment and modify these based on your security requirements

-- CREATE ROLE qa_admin;
-- CREATE ROLE qa_user;
-- CREATE ROLE qa_readonly;

-- Grant permissions to roles
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO qa_admin;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO qa_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO qa_readonly;

-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qa_admin, qa_user;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'QA Sign Off Database Setup Completed Successfully!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Database: qa_signoff';
    RAISE NOTICE 'Tables created: 6 (User, VDS, Sign_Off_Req, test_cases, defects, knowledge_share)';
    RAISE NOTICE 'Views created: 3 (sign_off_summary, test_case_summary, defect_summary)';
    RAISE NOTICE 'Indexes created: 15+ for optimal performance';
    RAISE NOTICE 'Triggers created: 8 for automatic calculations and timestamps';
    RAISE NOTICE 'Sample data: 5 users, 5 VDS entries, 3 sign-offs with related data';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Default admin credentials:';
    RAISE NOTICE 'Email: admin@test.com';
    RAISE NOTICE 'Password: admin123';
    RAISE NOTICE '============================================================================';
END $$;

-- PostgreSQL Complete Database Setup for QA Sign Off Process Automation
-- This file contains all tables, indexes, and sample data needed for the application

-- Create Database (run this command separately if needed)
-- CREATE DATABASE qa_signoff;

-- User Table
CREATE TABLE "User" (
    userid SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    email_id VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VDS Table
CREATE TABLE "VDS" (
    VDS_ID SERIAL PRIMARY KEY,
    VDS_Name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sign_Off_Req Table (with all required columns)
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
    rag_status VARCHAR(50),
    project_details TEXT,
    observations TEXT,
    "outOfScope" TEXT,
    caveats TEXT,
    evidences TEXT,
    comments TEXT,
    tasktype VARCHAR(100),
    "SignOffType" VARCHAR(100),
    defect_filter_link TEXT,
    VDS_id INTEGER REFERENCES "VDS"(VDS_ID),
    user_id INTEGER REFERENCES "User"(userid),
    status VARCHAR(50),
    JIRA_Link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- test_cases Table (with test_type column)
CREATE TABLE "test_cases" (
    ID SERIAL PRIMARY KEY,
    sign_off_id INTEGER REFERENCES "Sign_Off_Req"(ID) ON DELETE CASCADE,
    test_type VARCHAR(50),
    Passed INTEGER DEFAULT 0,
    Failed INTEGER DEFAULT 0,
    "Non-Executed" INTEGER DEFAULT 0,
    Total INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- defects Table (with defect_type column)
CREATE TABLE "defects" (
    ID SERIAL PRIMARY KEY,
    sign_off_id INTEGER REFERENCES "Sign_Off_Req"(ID) ON DELETE CASCADE,
    defect_type VARCHAR(50),
    Resolved INTEGER DEFAULT 0,
    Deffered INTEGER DEFAULT 0,
    Total INTEGER DEFAULT 0,
    defect_filter_Link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- knowledge_share Table
CREATE TABLE "knowledge_share" (
    ID SERIAL PRIMARY KEY,
    Subject VARCHAR(255),
    Description TEXT,
    UploadedDocument VARCHAR(255),
    user_id INTEGER REFERENCES "User"(userid),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for performance
CREATE INDEX idx_sign_off_vds_id ON "Sign_Off_Req"(VDS_id);
CREATE INDEX idx_sign_off_user_id ON "Sign_Off_Req"(user_id);
CREATE INDEX idx_sign_off_status ON "Sign_Off_Req"(status);
CREATE INDEX idx_sign_off_project_name ON "Sign_Off_Req"(project_name);
CREATE INDEX idx_test_cases_sign_off_id ON "test_cases"(sign_off_id);
CREATE INDEX idx_test_cases_type ON "test_cases"(test_type);
CREATE INDEX idx_defects_sign_off_id ON "defects"(sign_off_id);
CREATE INDEX idx_defects_type ON "defects"(defect_type);
CREATE INDEX idx_knowledge_share_user_id ON "knowledge_share"(user_id);
CREATE INDEX idx_knowledge_share_subject ON "knowledge_share"(Subject);

-- Insert sample VDS data
INSERT INTO "VDS" (VDS_Name) VALUES 
('S&P Trailblazer'),
('Invollo'),
('Digiexpert');

-- Insert a sample user for testing (password is 'admin123' hashed with bcrypt)
INSERT INTO "User" (firstname, lastname, email_id, password) VALUES 
('Admin', 'User', 'admin@test.com', '$2b$10$rOZY3A8xqIVq8xqk9z1zNu9RVZ3h8QbB8YfN6yPqVBfVwUvyKQXXK');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vds_updated_at BEFORE UPDATE ON "VDS"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sign_off_req_updated_at BEFORE UPDATE ON "Sign_Off_Req"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON "test_cases"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_defects_updated_at BEFORE UPDATE ON "defects"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_share_updated_at BEFORE UPDATE ON "knowledge_share"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Display completion message
SELECT 'Database setup completed successfully!' AS message;

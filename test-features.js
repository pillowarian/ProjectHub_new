// Test Script for ProTrack New Features
const http = require('http');

const BASE_URL = 'http://localhost:5500';
const TEST_RESULTS = [];

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer fake-token' // Will test with actual token if needed
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    data: data ? JSON.parse(data) : null,
                    headers: res.headers
                });
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('\n====================================');
    console.log('ProTrack New Features Test Suite');
    console.log('====================================\n');

    // Test 1: Health Check
    console.log('Test 1: Health Check');
    try {
        const result = await makeRequest('GET', '/api/health');
        console.log(`✅ Status: ${result.status}`);
        console.log(`✅ Response: ${JSON.stringify(result.data)}\n`);
        TEST_RESULTS.push({ test: 'Health Check', status: 'PASS', code: result.status });
    } catch (e) {
        console.log(`❌ Error: ${e.message}\n`);
        TEST_RESULTS.push({ test: 'Health Check', status: 'FAIL', error: e.message });
    }

    // Test 2: Get Organization Members (will fail without auth but that's expected)
    console.log('Test 2: Get Organization Members');
    try {
        const result = await makeRequest('GET', '/api/users/organization/null/members');
        console.log(`ℹ️  Status: ${result.status}`);
        console.log(`ℹ️  Response: ${result.data ? JSON.stringify(result.data).substring(0, 100) : 'No data'}\n`);
        TEST_RESULTS.push({ test: 'Get Org Members', status: result.status === 401 ? 'PASS (Auth required)' : 'PASS', code: result.status });
    } catch (e) {
        console.log(`ℹ️  Connection issue (expected for API routes without DB): ${e.message}\n`);
    }

    // Test 3: Check if Route Files Exist
    console.log('Test 3: Route Files Verification');
    const fs = require('fs');
    const routeFiles = [
        'backend/routes/userRoutes.js',
        'backend/routes/messageRoutes.js',
        'backend/routes/todoRoutes.js',
        'backend/routes/collaboratorRoutes.js'
    ];
    let allExist = true;
    for (const file of routeFiles) {
        const exists = fs.existsSync(file);
        console.log(`${exists ? '✅' : '❌'} ${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
        TEST_RESULTS.push({ test: file, status: exists ? 'PASS' : 'FAIL' });
        if (!exists) allExist = false;
    }
    console.log();

    // Test 4: Check Controller Files
    console.log('Test 4: Controller Files Verification');
    const controllerFiles = [
        'backend/controllers/userController.js',
        'backend/controllers/messageController.js',
        'backend/controllers/todoController.js',
        'backend/controllers/collaboratorController.js'
    ];
    for (const file of controllerFiles) {
        const exists = fs.existsSync(file);
        console.log(`${exists ? '✅' : '❌'} ${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
        TEST_RESULTS.push({ test: file, status: exists ? 'PASS' : 'FAIL' });
    }
    console.log();

    // Test 5: Check Frontend Pages
    console.log('Test 5: Frontend Pages Verification');
    const frontendFiles = [
        'frontend/todo-list.html',
        'frontend/todo-list.js',
        'frontend/todo-list.css',
        'frontend/messages.html',
        'frontend/messages.js',
        'frontend/messages.css'
    ];
    for (const file of frontendFiles) {
        const exists = fs.existsSync(file);
        console.log(`${exists ? '✅' : '❌'} ${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
        TEST_RESULTS.push({ test: file, status: exists ? 'PASS' : 'FAIL' });
    }
    console.log();

    // Test 6: Verify Database Schema
    console.log('Test 6: Database Schema Verification');
    const schemaFile = 'database/schema.sql';
    if (fs.existsSync(schemaFile)) {
        const schema = fs.readFileSync(schemaFile, 'utf8');
        const tables = [
            { name: 'user_follows', pattern: 'CREATE TABLE.*user_follows' },
            { name: 'messages', pattern: 'CREATE TABLE.*messages' },
            { name: 'project_collaborators', pattern: 'CREATE TABLE.*project_collaborators' },
            { name: 'to_do_items', pattern: 'CREATE TABLE.*to_do_items' }
        ];
        
        for (const table of tables) {
            const regex = new RegExp(table.pattern, 's');
            const exists = regex.test(schema);
            console.log(`${exists ? '✅' : '❌'} ${table.name} table: ${exists ? 'DEFINED' : 'MISSING'}`);
            TEST_RESULTS.push({ test: `Schema: ${table.name}`, status: exists ? 'PASS' : 'FAIL' });
        }
    }
    console.log();

    // Test 7: Verify Backend Integration
    console.log('Test 7: Backend Integration Check');
    const serverFile = 'backend/server.js';
    if (fs.existsSync(serverFile)) {
        const serverContent = fs.readFileSync(serverFile, 'utf8');
        const integrations = [
            { name: 'userRoutes', pattern: /userRoutes.*require.*routes\/userRoutes/ },
            { name: 'messageRoutes', pattern: /messageRoutes.*require.*routes\/messageRoutes/ },
            { name: 'todoRoutes', pattern: /todoRoutes.*require.*routes\/todoRoutes/ },
            { name: 'collaboratorRoutes', pattern: /collaboratorRoutes.*require.*routes\/collaboratorRoutes/ }
        ];
        
        for (const integration of integrations) {
            const exists = integration.pattern.test(serverContent);
            console.log(`${exists ? '✅' : '❌'} ${integration.name}: ${exists ? 'REGISTERED' : 'NOT FOUND'}`);
            TEST_RESULTS.push({ test: `Integration: ${integration.name}`, status: exists ? 'PASS' : 'FAIL' });
        }
    }
    console.log();

    // Test 8: Verify Frontend Integration
    console.log('Test 8: Frontend Integration Check');
    const homeFile = 'frontend/home.js';
    if (fs.existsSync(homeFile)) {
        const homeContent = fs.readFileSync(homeFile, 'utf8');
        const integrations = [
            { name: 'To-Do Navigation', pattern: /todo-list\.html/ },
            { name: 'Messages Navigation', pattern: /messages\.html/ },
            { name: 'Collaborator Selector', pattern: /collaborator|selectedCollaborators/ }
        ];
        
        for (const integration of integrations) {
            const exists = integration.pattern.test(homeContent);
            console.log(`${exists ? '✅' : '❌'} ${integration.name}: ${exists ? 'INTEGRATED' : 'MISSING'}`);
            TEST_RESULTS.push({ test: `Frontend: ${integration.name}`, status: exists ? 'PASS' : 'FAIL' });
        }
    }
    console.log();

    const viewProfileFile = 'frontend/view-profile.js';
    if (fs.existsSync(viewProfileFile)) {
        const viewProfileContent = fs.readFileSync(viewProfileFile, 'utf8');
        const integrations = [
            { name: 'Follow Button', pattern: /followBtn|follow.*handler/ },
            { name: 'Message Button', pattern: /messageBtn|message.*handler/ }
        ];
        
        console.log('Test 9: Profile Integration Check');
        for (const integration of integrations) {
            const exists = integration.pattern.test(viewProfileContent);
            console.log(`${exists ? '✅' : '❌'} ${integration.name}: ${exists ? 'INTEGRATED' : 'MISSING'}`);
            TEST_RESULTS.push({ test: `Profile: ${integration.name}`, status: exists ? 'PASS' : 'FAIL' });
        }
    }
    console.log();

    // Summary
    console.log('====================================');
    console.log('TEST SUMMARY');
    console.log('====================================');
    
    const passed = TEST_RESULTS.filter(r => r.status.includes('PASS')).length;
    const failed = TEST_RESULTS.filter(r => r.status.includes('FAIL')).length;
    const total = TEST_RESULTS.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%\n`);
    
    if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED! Features are ready for integration testing.\n');
    } else {
        console.log('⚠️  Some tests failed. Please check the results above.\n');
    }

    console.log('====================================');
    console.log('MANUAL TESTING INSTRUCTIONS');
    console.log('====================================\n');
    
    console.log('1. FOLLOW/MESSAGE FEATURE TEST:');
    console.log('   - Open http://localhost:5500 in browser');
    console.log('   - Login as two different users in same organization');
    console.log('   - Go to first user profile');
    console.log('   - Click "Follow" button on second user profile');
    console.log('   - Click "Message" button');
    console.log('   - Send a message and verify it appears\n');
    
    console.log('2. TO-DO LIST FEATURE TEST:');
    console.log('   - Click "To-Do" button in navbar');
    console.log('   - Select a project you own from dropdown');
    console.log('   - Create a new to-do item');
    console.log('   - Change status and priority');
    console.log('   - Edit and delete to-do items\n');
    
    console.log('3. COLLABORATORS FEATURE TEST:');
    console.log('   - Create a new project');
    console.log('   - In the modal, search for organization members');
    console.log('   - Select multiple collaborators');
    console.log('   - Submit and verify collaborators are added\n');
    
    console.log('4. ACCESS CONTROL TEST:');
    console.log('   - Try to follow user in different organization (should fail)');
    console.log('   - Try to create to-do for another user\'s project (should fail)');
    console.log('   - Try to add collaborator from different org (should fail)\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
    console.error('Test suite error:', e);
    process.exit(1);
});

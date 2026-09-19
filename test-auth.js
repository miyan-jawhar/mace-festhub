const puppeteer = require('puppeteer-core');

(async () => {
    console.log('Launching Microsoft Edge...');
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        headless: false,
        args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log('Opening localhost:3000...');
        await page.goto('http://localhost:3000');
        
        console.log('Clicking Login button...');
        await page.waitForSelector('a[href="/login.html"]');
        await page.click('a[href="/login.html"]');
        
        console.log('Waiting for Login Page...');
        await page.waitForSelector('#tab-register');
        
        console.log('Switching to Register Tab...');
        await page.click('#tab-register');
        await page.waitForSelector('#reg-name', { visible: true });
        
        // Randomize email to avoid unique constraint violation if run multiple times
        const rand = Math.floor(Math.random() * 100000);
        const email = `test${rand}@mace.ac.in`;
        
        console.log(`Filling Registration Form for ${email}...`);
        await page.type('#reg-name', 'Test Student');
        await page.type('#reg-email', email);
        await page.type('#reg-password', 'password123');
        await page.select('#reg-year', '1');
        await page.select('#reg-role', 'student');
        
        console.log('Submitting Registration...');
        await page.click('#register-submit-btn');
        
        console.log('Waiting for redirect to home...');
        await page.waitForSelector('.nav-logout-btn', { timeout: 10000 });
        console.log('Successfully logged in! Logout button found.');
        
        console.log('Going to Profile Page...');
        await page.waitForSelector('a[href="/profile.html"]');
        await page.click('a[href="/profile.html"]');
        
        console.log('Verifying Profile Page UI...');
        await page.waitForSelector('#sb-my-regs');
        await page.waitForSelector('#sb-profile');
        console.log('Profile page sidebar loaded successfully.');
        
        console.log('Logging out...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('.nav-logout-btn')
        ]);
        console.log('Successfully logged out.');
        
        console.log('Test completed successfully! ✅');
    } catch (e) {
        console.error('Test failed! ❌', e);
    } finally {
        setTimeout(async () => {
            console.log('Closing browser...');
            await browser.close();
        }, 3000);
    }
})();

import { chromium } from '@playwright/test'; import { createServer } from 'vite';
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:4196,strictPort:true}}); await server.listen(); const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const variants=[
 ['current',''],
 ['break-last','@media print {.workstation-sheet,.two-up-sheet{break-after:auto}.workstation-sheet:not(:last-child),.two-up-sheet:not(:last-child){break-after:page}}'],
 ['body-root','@media print {html,body,#root{min-height:0;height:auto}.workstation-sheet,.two-up-sheet{break-after:auto}.workstation-sheet:not(:last-child),.two-up-sheet:not(:last-child){break-after:page}}'],
 ['preview','@media print {html,body,#root{min-height:0;height:auto}.print-preview{gap:0}.workstation-sheet,.two-up-sheet{break-after:auto}.workstation-sheet:not(:last-child),.two-up-sheet:not(:last-child){break-after:page}}'],
];
try { for(const [name,css] of variants){const page=await browser.newPage(); await page.goto('http://127.0.0.1:4196/nntn-cookbook/#/print'); await page.getByRole('checkbox',{name:'ข้าวขยำเนื้อแดดเดียว · รหัส 37'}).check(); await page.getByRole('combobox',{name:/^จุดงาน/u}).selectOption('service'); await page.locator('.workstation-sheet').waitFor(); if(css)await page.addStyleTag({content:css}); const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true}); console.log(name,[...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/g)].map(m=>[m[1],m[2]])); await page.close();}} finally {await browser.close(); await server.close();}

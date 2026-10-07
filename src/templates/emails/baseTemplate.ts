export const baseTemplate = (title: string, body: string) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body{
    margin:0;
    padding:0;
    background:#f5f5f5;
    font-family:Arial,Helvetica,sans-serif;
}

.container{
    max-width:600px;
    margin:40px auto;
    background:#ffffff;
    border-radius:10px;
    overflow:hidden;
}

.header{
    background:#2B6CB0;
    color:white;
    padding:25px;
    text-align:center;
    font-size:28px;
    font-weight:bold;
}

.content{
    padding:35px;
    color:#333;
    line-height:1.6;
}

.button{
    display:inline-block;
    padding:14px 30px;
    background:#2B6CB0;
    color:#fff !important;
    text-decoration:none;
    border-radius:6px;
    font-weight:bold;
}

.code{
    font-size:32px;
    letter-spacing:6px;
    text-align:center;
    font-weight:bold;
    margin:25px 0;
}

.footer{
    padding:20px;
    background:#f2f2f2;
    text-align:center;
    color:#888;
    font-size:13px;
}
</style>
</head>

<body>

<div class="container">

<div class="header">
Task Manager
</div>

<div class="content">

<h2>${title}</h2>

${body}

</div>

<div class="footer">

© ${new Date().getFullYear()} Task Management. All rights reserved.

</div>

</div>

</body>
</html>
`;

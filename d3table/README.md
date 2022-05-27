
Example URL to access data file and columns definitions without installing the HTML file:

  `https://raw.githack.com/glygen-glycan-data/JSWidgets/master/d3table/d3table.html?<URL-of-Datafile>`
  
Note that the server serving the data and column definitions will require CORS configuration to be enabled for `https://raw.githack.com` using the (apache) command 
  
  `Header set Access-Control-Allow-Origin "https://raw.githack.com"`   
  
or 
  
  `Header set Access-Control-Allow-Origin "*"`   
  
in the global configuration options, the virtual host definition, or a `.htaccess` file. Alternatively, the repository contents can be placed on the same server as the data file and column definitions. 

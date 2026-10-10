module.exports=(sequelize,Datatype)=>{
    const TokenUser=sequelize.define("TokenUser",{
        token:{
            type:Datatype.STRING,
            allowNull:false
        },
          
       
          
    })
    TokenUser.associate=models=>{
        TokenUser.belongsTo(models.user,{
            onDelete:"cascade",
            foreignKey: {
                allowNull: false,
              }
        }) 
        
    }
    return TokenUser
}
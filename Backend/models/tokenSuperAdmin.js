module.exports=(sequelize,Datatype)=>{
    const TokenSuperAdmin=sequelize.define("TokenSuperAdmin",{
        token:{
            type:Datatype.STRING,
            allowNull:false
        },
          
       
          
    })
    TokenSuperAdmin.associate=models=>{
        TokenSuperAdmin.belongsTo(models.superAdmin,{
            onDelete:"cascade",
            foreignKey: {
                allowNull: false,
              }
        }) 
        
    }
    return TokenSuperAdmin
}
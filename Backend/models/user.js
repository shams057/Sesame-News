module.exports=(sequelize,Datatype)=>{
    const user=sequelize.define("user",{
        login:{
            type:Datatype.STRING, 
            allowNull:false
        },
        password:{
            type:Datatype.STRING, 
            allowNull:false
        },
       firstname:{
            type:Datatype.STRING(15),
            allowNull:false
        },
        lastname:{
            type:Datatype.STRING(15), 
            allowNull:false
        },
        GC: {
            type: Datatype.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    })
    user.associate=models=>{
        user.hasMany(models.news,{
            onDelete:"cascade"
        })
        user.hasMany(models.TokenUser,{
            onDelete:"cascade"
        })
        user.belongsTo(models.categorie,{
            onDelete:"cascade",
            foreignKey: {
                allowNull: false,
              }
        }) 
    }
    return user
}